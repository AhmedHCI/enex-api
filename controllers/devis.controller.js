const fs = require("fs");
const path = require("path");
const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");
const { computeTotal, computeDocumentTotals } = require("../utils/lineTotals");
const { generateDocumentPdf } = require("../utils/generateDocumentPdf");
const { buildPdfPayload } = require("../utils/pdfPayload");
const { fetchFactureById } = require("./factures.controller");

const documentsDir = path.join(__dirname, "..", "documents");

function baseUrlFrom(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function signatureFilePath(id) {
  return path.join(documentsDir, `signature-devis-${id}.png`);
}

const devisSupportSchema = Joi.object({
  id_support: Joi.number().integer().required(),
  longueur: Joi.number().min(0).allow(null).default(null),
  largeur: Joi.number().min(0).allow(null).default(null),
  superficie: Joi.number().min(0).allow(null).default(null),
  hauteur: Joi.number().min(0).allow(null).default(null),
  prix_m2: Joi.number().min(0).allow(null).default(null),
});

const devisPrestationSchema = Joi.object({
  id_prestation: Joi.number().integer().required(),
  supports: Joi.array().items(devisSupportSchema).min(1).required(),
});

const devisSchema = Joi.object({
  id_chantier: Joi.number().integer().required(),
  // Chaîne brute (pas Joi.date()) pour éviter une conversion en Date JS qui,
  // reformatée dans le fuseau horaire du serveur, peut décaler le jour de -1.
  date_devis: Joi.string().isoDate().required(),
  taux_tva: Joi.number().min(0).max(100),
  notes: Joi.string().allow("", null),
  prestations: Joi.array().items(devisPrestationSchema).min(1).required(),
});

const devisUpdateSchema = devisSchema.fork(
  ["id_chantier", "date_devis", "prestations"],
  (field) => field.optional()
);

// Prix au m² repris du catalogue supports si non fourni explicitement.
async function resolveSupports(connection, supports) {
  const ids = [...new Set(supports.map((s) => s.id_support))];
  const [rows] = await connection.query("SELECT id_support, prix_m2 FROM supports WHERE id_support IN (?)", [
    ids,
  ]);
  const prixById = new Map(rows.map((r) => [r.id_support, r.prix_m2]));

  const missing = ids.filter((id) => !prixById.has(id));
  if (missing.length) {
    throw new AppError(`Support inconnu : ${missing.join(", ")}`, 400, "SUPPORT_NOT_FOUND");
  }

  return supports.map((s) => ({
    ...s,
    prix_m2: s.prix_m2 !== undefined && s.prix_m2 !== null ? s.prix_m2 : prixById.get(s.id_support),
  }));
}

async function insertPrestations(connection, idDevis, prestations) {
  for (const prestation of prestations) {
    const [result] = await connection.query(
      "INSERT INTO devis_prestations (id_devis, id_prestation) VALUES (?, ?)",
      [idDevis, prestation.id_prestation]
    );
    const idDevisPrestation = result.insertId;

    const resolvedSupports = await resolveSupports(connection, prestation.supports);
    await connection.query(
      `INSERT INTO devis_prestation_supports
       (id_devis_prestation, id_support, longueur, largeur, superficie, hauteur, prix_m2) VALUES ?`,
      [
        resolvedSupports.map((s) => [
          idDevisPrestation, s.id_support, s.longueur, s.largeur, s.superficie, s.hauteur, s.prix_m2,
        ]),
      ]
    );
  }
}

async function attachDetails(devisRows, baseUrl) {
  if (!devisRows.length) return devisRows;
  const devisIds = devisRows.map((d) => d.id_devis);

  const [prestationRows] = await db.query(
    `SELECT dp.id_devis_prestation, dp.id_devis, dp.id_prestation, p.nom AS nom_prestation
     FROM devis_prestations dp
     JOIN prestations p ON p.id_prestation = dp.id_prestation
     WHERE dp.id_devis IN (?) ORDER BY dp.id_devis_prestation ASC`,
    [devisIds]
  );

  const prestationIds = prestationRows.map((p) => p.id_devis_prestation);
  let supportRows = [];
  if (prestationIds.length) {
    [supportRows] = await db.query(
      `SELECT dps.*, s.type_support
       FROM devis_prestation_supports dps
       JOIN supports s ON s.id_support = dps.id_support
       WHERE dps.id_devis_prestation IN (?) ORDER BY dps.id_devis_prestation_support ASC`,
      [prestationIds]
    );
  }

  const prestations = prestationRows.map((p) => {
    const supports = supportRows
      .filter((s) => s.id_devis_prestation === p.id_devis_prestation)
      .map((s) => ({ ...s, total: computeTotal(s) }));
    const sousTotal = supports.reduce((sum, s) => sum + (s.total ?? 0), 0);
    return { ...p, supports, sous_total: Number(sousTotal.toFixed(2)) };
  });

  return devisRows.map((devis) => {
    const devisPrestations = prestations.filter((p) => p.id_devis === devis.id_devis);
    const totalHt = devisPrestations.reduce((sum, p) => sum + p.sous_total, 0);
    return {
      ...devis,
      prestations: devisPrestations,
      ...computeDocumentTotals(totalHt, devis.taux_tva),
      signature_url: devis.signed_at
        ? `${baseUrl}/documents/signature-devis-${devis.id_devis}.png?t=${new Date(devis.signed_at).getTime()}`
        : null,
    };
  });
}

const baseSelect = `
  SELECT d.*,
    ch.adresse AS chantier_adresse, ch.cp AS chantier_cp, ch.ville AS chantier_ville,
    ch.date_rdv AS chantier_date_rdv,
    cl.id_client, cl.nom AS client_nom, cl.prenom AS client_prenom, cl.nom_societe AS client_nom_societe,
    cl.adresse AS client_adresse, cl.cp AS client_cp, cl.ville AS client_ville,
    cl.telephone AS client_telephone, cl.portable AS client_portable, cl.email AS client_email
  FROM devis d
  JOIN chantiers ch ON ch.id_chantier = d.id_chantier
  JOIN clients cl ON cl.id_client = ch.id_client
  WHERE 1=1
`;
const countSelect = baseSelect.replace(
  /SELECT d\.\*,[\s\S]*?WHERE 1=1/,
  `SELECT COUNT(*) as total
   FROM devis d
   JOIN chantiers ch ON ch.id_chantier = d.id_chantier
   JOIN clients cl ON cl.id_client = ch.id_client
   WHERE 1=1`
);

async function fetchDevisById(id, baseUrl) {
  const [devis] = await db.query(`${baseSelect} AND d.id_devis = ?`, [id]);
  if (!devis.length) {
    throw new AppError("Devis non trouvé", 404, "DEVIS_NOT_FOUND");
  }
  const [withDetails] = await attachDetails(devis, baseUrl);
  return withDetails;
}

const devisController = {
  // Récupérer tous les devis (recherche + pagination + filtre chantier)
  getAll: catchAsync(async (req, res) => {
    const { search, id_chantier, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = baseSelect;
    let countQuery = countSelect;
    const params = [];

    if (id_chantier) {
      query += " AND d.id_chantier = ?";
      countQuery += " AND d.id_chantier = ?";
      params.push(id_chantier);
    }

    if (search) {
      query += " AND (cl.nom LIKE ? OR cl.nom_societe LIKE ? OR ch.adresse LIKE ? OR ch.ville LIKE ?)";
      countQuery += " AND (cl.nom LIKE ? OR cl.nom_societe LIKE ? OR ch.adresse LIKE ? OR ch.ville LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;

    query += " ORDER BY d.date_devis DESC, d.id_devis DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    const [devis] = await db.query(query, params);
    const withDetails = await attachDetails(devis, baseUrlFrom(req));

    res.json({
      devis: withDetails,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Récupérer un devis par ID
  getById: catchAsync(async (req, res) => {
    const devis = await fetchDevisById(req.params.id, baseUrlFrom(req));
    res.json(devis);
  }),

  // Générer (ou régénérer) le PDF du devis et renvoyer son URL
  generatePdf: catchAsync(async (req, res) => {
    const { id } = req.params;
    const devis = await fetchDevisById(id, baseUrlFrom(req));
    const [societeRows] = await db.query("SELECT * FROM societe ORDER BY id_societe ASC LIMIT 1");

    const payload = buildPdfPayload(devis, { label: "Devis", numero: devis.id_devis, date: devis.date_devis });
    const signaturePath = signatureFilePath(id);
    if (devis.signed_at && fs.existsSync(signaturePath)) {
      payload.signatureImagePath = signaturePath;
    }

    const filename = `devis-${id}.pdf`;
    const filePath = path.join(documentsDir, filename);
    await generateDocumentPdf(payload, societeRows[0] || null, filePath);

    const url = `${req.protocol}://${req.get("host")}/documents/${filename}`;
    res.json({ url });
  }),

  // Marquer le devis comme validé (accepté par le client), sans signature
  validate: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [existing] = await db.query("SELECT statut FROM devis WHERE id_devis = ?", [id]);
    if (!existing.length) {
      throw new AppError("Devis non trouvé", 404, "DEVIS_NOT_FOUND");
    }
    if (existing[0].statut === "facture") {
      throw new AppError("Ce devis a déjà été transformé en facture", 400, "DEVIS_ALREADY_INVOICED");
    }

    await db.query("UPDATE devis SET statut = 'valide', updated_at = ? WHERE id_devis = ?", [
      new Date(),
      id,
    ]);

    res.json(await fetchDevisById(id, baseUrlFrom(req)));
  }),

  // Enregistre la signature manuscrite du client : valide le devis dans la foulée.
  sign: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { image } = req.body;

    if (!image || typeof image !== "string") {
      throw new AppError("Signature manquante", 400, "SIGNATURE_REQUIRED");
    }

    const [existing] = await db.query("SELECT statut FROM devis WHERE id_devis = ?", [id]);
    if (!existing.length) {
      throw new AppError("Devis non trouvé", 404, "DEVIS_NOT_FOUND");
    }
    if (existing[0].statut === "facture") {
      throw new AppError("Ce devis a déjà été transformé en facture", 400, "DEVIS_ALREADY_INVOICED");
    }

    const base64 = image.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(signatureFilePath(id), Buffer.from(base64, "base64"));

    const now = new Date();
    await db.query("UPDATE devis SET statut = 'valide', signed_at = ?, updated_at = ? WHERE id_devis = ?", [
      now,
      now,
      id,
    ]);

    res.json(await fetchDevisById(id, baseUrlFrom(req)));
  }),

  // Transformer le devis validé en facture (copie figée des prestations/supports)
  convertToFacture: catchAsync(async (req, res) => {
    const { id } = req.params;
    const devis = await fetchDevisById(id, baseUrlFrom(req));

    if (devis.statut !== "valide") {
      throw new AppError(
        "Le devis doit être validé avant d'être transformé en facture",
        400,
        "DEVIS_NOT_VALIDATED"
      );
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        "INSERT INTO factures (id_devis, id_chantier, date_facture, taux_tva, signed_at, notes) VALUES (?, ?, ?, ?, ?, ?)",
        [devis.id_devis, devis.id_chantier, new Date(), devis.taux_tva, devis.signed_at ?? null, devis.notes ?? null]
      );
      const idFacture = result.insertId;

      const devisSignaturePath = signatureFilePath(id);
      if (devis.signed_at && fs.existsSync(devisSignaturePath)) {
        fs.copyFileSync(devisSignaturePath, path.join(documentsDir, `signature-facture-${idFacture}.png`));
      }

      for (const prestation of devis.prestations) {
        const [prestationResult] = await connection.query(
          "INSERT INTO facture_prestations (id_facture, id_prestation) VALUES (?, ?)",
          [idFacture, prestation.id_prestation]
        );
        const idFacturePrestation = prestationResult.insertId;

        await connection.query(
          `INSERT INTO facture_prestation_supports
           (id_facture_prestation, id_support, longueur, largeur, superficie, hauteur, prix_m2) VALUES ?`,
          [
            prestation.supports.map((s) => [
              idFacturePrestation, s.id_support, s.longueur, s.largeur, s.superficie, s.hauteur, s.prix_m2,
            ]),
          ]
        );
      }

      await connection.query("UPDATE devis SET statut = 'facture', updated_at = ? WHERE id_devis = ?", [
        new Date(),
        id,
      ]);

      await connection.commit();

      res.status(201).json(await fetchFactureById(idFacture, baseUrlFrom(req)));
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }),

  // Créer un nouveau devis
  create: catchAsync(async (req, res) => {
    const { error, value } = devisSchema.validate(req.body);
    if (error) throw error;

    const { prestations, ...devisData } = value;

    if (devisData.taux_tva === undefined) {
      const [societeRows] = await db.query("SELECT tva FROM societe ORDER BY id_societe ASC LIMIT 1");
      devisData.taux_tva = societeRows[0]?.tva ?? 0;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query("INSERT INTO devis SET ?", [devisData]);
      const idDevis = result.insertId;

      await insertPrestations(connection, idDevis, prestations);

      await connection.commit();

      const [devis] = await db.query(`${baseSelect} AND d.id_devis = ?`, [idDevis]);
      const [withDetails] = await attachDetails(devis, baseUrlFrom(req));
      res.status(201).json(withDetails);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }),

  // Mettre à jour un devis
  update: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { error, value } = devisUpdateSchema.validate(req.body);
    if (error) throw error;

    const [existing] = await db.query("SELECT id_devis FROM devis WHERE id_devis = ?", [id]);
    if (!existing.length) {
      throw new AppError("Devis non trouvé", 404, "DEVIS_NOT_FOUND");
    }

    const { prestations, ...devisData } = value;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query("UPDATE devis SET ? WHERE id_devis = ?", [
        { ...devisData, updated_at: new Date() },
        id,
      ]);

      if (prestations) {
        await connection.query("DELETE FROM devis_prestations WHERE id_devis = ?", [id]);
        await insertPrestations(connection, id, prestations);
      }

      await connection.commit();

      const [devis] = await db.query(`${baseSelect} AND d.id_devis = ?`, [id]);
      const [withDetails] = await attachDetails(devis, baseUrlFrom(req));
      res.json(withDetails);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }),

  // Supprimer un devis
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM devis WHERE id_devis = ?", [id]);

    if (result.affectedRows === 0) {
      throw new AppError("Devis non trouvé", 404, "DEVIS_NOT_FOUND");
    }

    res.status(204).send();
  }),
};

module.exports = devisController;
