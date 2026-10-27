const path = require("path");
const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");
const { computeTotal, computeDocumentTotals } = require("../utils/lineTotals");
const { generateDocumentPdf } = require("../utils/generateDocumentPdf");
const { buildPdfPayload } = require("../utils/pdfPayload");

const documentsDir = path.join(__dirname, "..", "documents");

function baseUrlFrom(req) {
  return `${req.protocol}://${req.get("host")}`;
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
    const totals = computeDocumentTotals(totalHt, facture.taux_tva, facture.remise);
    const montantRegle = Number(facture.montant_regle);
    // Réglée seulement si le cumul des règlements couvre le total TTC (pas juste
    // "il existe un règlement") : un acompte partiel laisse un solde à payer.
    const estReglee = totals.total_ttc > 0 && montantRegle >= totals.total_ttc - 0.01;
    return {
      ...facture,
      prestations: facturePrestations,
      ...totals,
      signature_url: facture.signed_at
        ? `${baseUrl}/documents/signature-facture-${facture.id_facture}.png`
        : null,
      est_reglee: estReglee,
      montant_regle: montantRegle,
      solde: Number((totals.total_ttc - montantRegle).toFixed(2)),
    };
  });
}

const baseSelect = `
  SELECT f.*,
    ch.adresse AS chantier_adresse, ch.cp AS chantier_cp, ch.ville AS chantier_ville,
    ch.date_rdv AS chantier_date_rdv,
    cl.id_client, cl.nom AS client_nom, cl.prenom AS client_prenom, cl.nom_societe AS client_nom_societe,
    cl.adresse AS client_adresse, cl.cp AS client_cp, cl.ville AS client_ville,
    cl.telephone AS client_telephone, cl.portable AS client_portable, cl.email AS client_email,
    ap.nom AS apporteur_nom, ap.prenom AS apporteur_prenom, ap.nom_societe AS apporteur_nom_societe,
    ap.commission AS apporteur_commission,
    (SELECT COUNT(*) FROM reglements r WHERE r.id_facture = f.id_facture) AS nombre_reglements,
    (SELECT COALESCE(SUM(r.montant), 0) FROM reglements r WHERE r.id_facture = f.id_facture) AS montant_regle
  FROM factures f
  JOIN chantiers ch ON ch.id_chantier = f.id_chantier
  JOIN clients cl ON cl.id_client = ch.id_client
  LEFT JOIN apporteurs_affaires ap ON ap.id_apporteur = f.id_apporteur
  WHERE 1=1
`;
const countSelect = baseSelect.replace(
  /SELECT f\.\*,[\s\S]*?WHERE 1=1/,
  `SELECT COUNT(*) as total
   FROM factures f
   JOIN chantiers ch ON ch.id_chantier = f.id_chantier
   JOIN clients cl ON cl.id_client = ch.id_client
   LEFT JOIN apporteurs_affaires ap ON ap.id_apporteur = f.id_apporteur
   WHERE 1=1`
);

const assignApporteurSchema = Joi.object({
  id_apporteur: Joi.number().integer().allow(null).required(),
});

async function fetchFactureById(id, baseUrl) {
  const [factures] = await db.query(`${baseSelect} AND f.id_facture = ?`, [id]);
  if (!factures.length) {
    throw new AppError("Facture non trouvée", 404, "FACTURE_NOT_FOUND");
  }
  const [withDetails] = await attachDetails(factures, baseUrl);
  return withDetails;
}

// Ajoute les filtres communs (chantier, apporteur, recherche, période) à une requête + ses params.
function applyFilters(query, params, { id_chantier, id_apporteur, search, date_debut, date_fin }) {
  if (id_chantier) {
    query += " AND f.id_chantier = ?";
    params.push(id_chantier);
  }

  if (id_apporteur) {
    query += " AND f.id_apporteur = ?";
    params.push(id_apporteur);
  }

  if (search) {
    query += " AND (cl.nom LIKE ? OR cl.nom_societe LIKE ? OR ch.adresse LIKE ? OR ch.ville LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (date_debut) {
    query += " AND f.date_facture >= ?";
    params.push(date_debut);
  }

  if (date_fin) {
    query += " AND f.date_facture <= ?";
    params.push(date_fin);
  }

  return query;
}

const facturesController = {
  // Récupérer toutes les factures (recherche + pagination + filtre chantier + période)
  getAll: catchAsync(async (req, res) => {
    const { search, id_chantier, id_apporteur, date_debut, date_fin, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const filters = { id_chantier, id_apporteur, search, date_debut, date_fin };

    const countParams = [];
    const countQuery = applyFilters(countSelect, countParams, filters);
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    const params = [];
    let query = applyFilters(baseSelect, params, filters);
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

  // Récapitulatif du chiffre d'affaires (recherche + filtre chantier + période, sans pagination)
  getTotals: catchAsync(async (req, res) => {
    const { search, id_chantier, id_apporteur, date_debut, date_fin } = req.query;
    const filters = { id_chantier, id_apporteur, search, date_debut, date_fin };

    const params = [];
    const query = applyFilters(baseSelect, params, filters);

    const [factures] = await db.query(query, params);
    const withDetails = await attachDetails(factures, baseUrlFrom(req));

    const totals = withDetails.reduce(
      (acc, f) => {
        // Commission de l'apporteur d'affaires assigné à la facture (% du total TTC),
        // ignorée si aucun apporteur n'est affecté.
        const commission =
          f.apporteur_commission != null
            ? ((f.total_ttc ?? 0) * Number(f.apporteur_commission)) / 100
            : 0;
        return {
          total_ht: acc.total_ht + (f.total_ht ?? 0),
          montant_tva: acc.montant_tva + (f.montant_tva ?? 0),
          total_ttc: acc.total_ttc + (f.total_ttc ?? 0),
          total_commissions: acc.total_commissions + commission,
        };
      },
      { total_ht: 0, montant_tva: 0, total_ttc: 0, total_commissions: 0 }
    );

    res.json({
      count: withDetails.length,
      total_ht: Number(totals.total_ht.toFixed(2)),
      montant_tva: Number(totals.montant_tva.toFixed(2)),
      total_ttc: Number(totals.total_ttc.toFixed(2)),
      total_commissions: Number(totals.total_commissions.toFixed(2)),
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
    const [reglements] = await db.query(
      "SELECT date_reglement, mode_reglement, numero_cheque, montant FROM reglements WHERE id_facture = ? ORDER BY date_reglement ASC",
      [id]
    );

    const payload = buildPdfPayload(
      { ...facture, reglements },
      {
        label: "Facture",
        numero: facture.id_facture,
        date: facture.date_facture,
      }
    );
    // La signature client n'est affichée que sur le PDF du devis, pas sur la facture.

    const filename = `facture-${id}.pdf`;
    const filePath = path.join(documentsDir, filename);
    await generateDocumentPdf(payload, societeRows[0] || null, filePath);

    const url = `${req.protocol}://${req.get("host")}/documents/${filename}`;
    res.json({ url });
  }),

  // Affecter (ou retirer) l'apporteur d'affaires d'une facture
  assignApporteur: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { error, value } = assignApporteurSchema.validate(req.body);
    if (error) throw error;

    const current = await fetchFactureById(id, baseUrlFrom(req)).catch(() => null);
    if (!current) {
      throw new AppError("Facture non trouvée", 404, "FACTURE_NOT_FOUND");
    }
    if (current.est_reglee) {
      throw new AppError(
        "Facture déjà réglée : l'apporteur d'affaires ne peut plus être modifié",
        400,
        "FACTURE_ALREADY_SETTLED"
      );
    }

    await db.query("UPDATE factures SET id_apporteur = ?, updated_at = ? WHERE id_facture = ?", [
      value.id_apporteur,
      new Date(),
      id,
    ]);

    res.json(await fetchFactureById(id, baseUrlFrom(req)));
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
