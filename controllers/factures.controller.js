const fs = require("fs");
const path = require("path");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");
const { computeTotal, computeDocumentTotals } = require("../utils/lineTotals");
const { generateDocumentPdf } = require("../utils/generateDocumentPdf");
const { buildPdfPayload } = require("../utils/pdfPayload");

const documentsDir = path.join(__dirname, "..", "documents");

function baseUrlFrom(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function signatureFilePath(id) {
  return path.join(documentsDir, `signature-facture-${id}.png`);
}

async function attachDetails(factureRows, baseUrl) {
  if (!factureRows.length) return factureRows;
  const factureIds = factureRows.map((f) => f.id_facture);

  const [prestationRows] = await db.query(
    `SELECT fp.id_facture_prestation, fp.id_facture, fp.id_prestation, p.nom AS nom_prestation
     FROM facture_prestations fp
     JOIN prestations p ON p.id_prestation = fp.id_prestation
     WHERE fp.id_facture IN (?) ORDER BY fp.id_facture_prestation ASC`,
    [factureIds]
  );

  const prestationIds = prestationRows.map((p) => p.id_facture_prestation);
  let supportRows = [];
  if (prestationIds.length) {
    [supportRows] = await db.query(
      `SELECT fps.*, s.type_support
       FROM facture_prestation_supports fps
       JOIN supports s ON s.id_support = fps.id_support
       WHERE fps.id_facture_prestation IN (?) ORDER BY fps.id_facture_prestation_support ASC`,
      [prestationIds]
    );
  }

  const prestations = prestationRows.map((p) => {
    const supports = supportRows
      .filter((s) => s.id_facture_prestation === p.id_facture_prestation)
      .map((s) => ({ ...s, total: computeTotal(s) }));
    const sousTotal = supports.reduce((sum, s) => sum + (s.total ?? 0), 0);
    return { ...p, supports, sous_total: Number(sousTotal.toFixed(2)) };
  });

  return factureRows.map((facture) => {
    const facturePrestations = prestations.filter((p) => p.id_facture === facture.id_facture);
    const totalHt = facturePrestations.reduce((sum, p) => sum + p.sous_total, 0);
    return {
      ...facture,
      prestations: facturePrestations,
      ...computeDocumentTotals(totalHt, facture.taux_tva),
      signature_url: facture.signed_at
        ? `${baseUrl}/documents/signature-facture-${facture.id_facture}.png`
        : null,
    };
  });
}

const baseSelect = `
  SELECT f.*,
    ch.adresse AS chantier_adresse, ch.cp AS chantier_cp, ch.ville AS chantier_ville,
    ch.date_rdv AS chantier_date_rdv,
    cl.id_client, cl.nom AS client_nom, cl.prenom AS client_prenom, cl.nom_societe AS client_nom_societe,
    cl.adresse AS client_adresse, cl.cp AS client_cp, cl.ville AS client_ville,
    cl.telephone AS client_telephone, cl.portable AS client_portable, cl.email AS client_email
  FROM factures f
  JOIN chantiers ch ON ch.id_chantier = f.id_chantier
  JOIN clients cl ON cl.id_client = ch.id_client
  WHERE 1=1
`;
const countSelect = baseSelect.replace(
  /SELECT f\.\*,[\s\S]*?WHERE 1=1/,
  `SELECT COUNT(*) as total
   FROM factures f
   JOIN chantiers ch ON ch.id_chantier = f.id_chantier
   JOIN clients cl ON cl.id_client = ch.id_client
   WHERE 1=1`
);

async function fetchFactureById(id, baseUrl) {
  const [factures] = await db.query(`${baseSelect} AND f.id_facture = ?`, [id]);
  if (!factures.length) {
    throw new AppError("Facture non trouvée", 404, "FACTURE_NOT_FOUND");
  }
  const [withDetails] = await attachDetails(factures, baseUrl);
  return withDetails;
}

const facturesController = {
  // Récupérer toutes les factures (recherche + pagination + filtre chantier)
  getAll: catchAsync(async (req, res) => {
    const { search, id_chantier, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = baseSelect;
    let countQuery = countSelect;
    const params = [];

    if (id_chantier) {
      query += " AND f.id_chantier = ?";
      countQuery += " AND f.id_chantier = ?";
      params.push(id_chantier);
    }

    if (search) {
      query += " AND (cl.nom LIKE ? OR cl.nom_societe LIKE ? OR ch.adresse LIKE ? OR ch.ville LIKE ?)";
      countQuery += " AND (cl.nom LIKE ? OR cl.nom_societe LIKE ? OR ch.adresse LIKE ? OR ch.ville LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;

    query += " ORDER BY f.date_facture DESC, f.id_facture DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    const [factures] = await db.query(query, params);
    const withDetails = await attachDetails(factures, baseUrlFrom(req));

    res.json({
      factures: withDetails,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Récupérer une facture par ID
  getById: catchAsync(async (req, res) => {
    const facture = await fetchFactureById(req.params.id, baseUrlFrom(req));
    res.json(facture);
  }),

  // Générer (ou régénérer) le PDF de la facture et renvoyer son URL
  generatePdf: catchAsync(async (req, res) => {
    const { id } = req.params;
    const facture = await fetchFactureById(id, baseUrlFrom(req));
    const [societeRows] = await db.query("SELECT * FROM societe ORDER BY id_societe ASC LIMIT 1");

    const payload = buildPdfPayload(facture, {
      label: "Facture",
      numero: facture.id_facture,
      date: facture.date_facture,
    });
    const signaturePath = signatureFilePath(id);
    if (facture.signed_at && fs.existsSync(signaturePath)) {
      payload.signatureImagePath = signaturePath;
    }

    const filename = `facture-${id}.pdf`;
    const filePath = path.join(documentsDir, filename);
    await generateDocumentPdf(payload, societeRows[0] || null, filePath);

    const url = `${req.protocol}://${req.get("host")}/documents/${filename}`;
    res.json({ url });
  }),

  // Supprimer une facture
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM factures WHERE id_facture = ?", [id]);

    if (result.affectedRows === 0) {
      throw new AppError("Facture non trouvée", 404, "FACTURE_NOT_FOUND");
    }

    res.status(204).send();
  }),
};

module.exports = { facturesController, fetchFactureById };
