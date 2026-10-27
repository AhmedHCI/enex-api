const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const reglementSchema = Joi.object({
  date_reglement: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  mode_reglement: Joi.string().valid("cheque", "especes", "virement").required(),
  numero_cheque: Joi.string().max(50).when("mode_reglement", {
    is: "cheque",
    then: Joi.required(),
    otherwise: Joi.allow("", null),
  }),
  montant: Joi.number().greater(0).required(),
  notes: Joi.string().allow("", null),
});

const baseSelect = `
  SELECT r.*,
    f.id_chantier, f.date_facture, f.id_devis,
    ch.adresse AS chantier_adresse, ch.ville AS chantier_ville,
    cl.nom AS client_nom, cl.prenom AS client_prenom, cl.nom_societe AS client_nom_societe
  FROM reglements r
  JOIN factures f ON f.id_facture = r.id_facture
  JOIN chantiers ch ON ch.id_chantier = f.id_chantier
  JOIN clients cl ON cl.id_client = ch.id_client
  WHERE 1=1
`;
const countSelect = baseSelect.replace(
  /SELECT r\.\*,[\s\S]*?WHERE 1=1/,
  `SELECT COUNT(*) as total
   FROM reglements r
   JOIN factures f ON f.id_facture = r.id_facture
   JOIN chantiers ch ON ch.id_chantier = f.id_chantier
   JOIN clients cl ON cl.id_client = ch.id_client
   WHERE 1=1`
);

function applyFilters(query, params, { id_facture, search, date_debut, date_fin }) {
  if (id_facture) {
    query += " AND r.id_facture = ?";
    params.push(id_facture);
  }
  if (search) {
    query += " AND (cl.nom LIKE ? OR cl.nom_societe LIKE ? OR ch.adresse LIKE ? OR ch.ville LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (date_debut) {
    query += " AND r.date_reglement >= ?";
    params.push(date_debut);
  }
  if (date_fin) {
    query += " AND r.date_reglement <= ?";
    params.push(date_fin);
  }
  return query;
}

const reglementsController = {
  // Récupérer tous les règlements (archive), recherche + pagination + période
  getAll: catchAsync(async (req, res) => {
    const { search, id_facture, date_debut, date_fin, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const filters = { id_facture, search, date_debut, date_fin };

    const countParams = [];
    const countQuery = applyFilters(countSelect, countParams, filters);
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    const params = [];
    let query = applyFilters(baseSelect, params, filters);
    query += " ORDER BY r.date_reglement DESC, r.id_reglement DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    const [reglements] = await db.query(query, params);

    res.json({
      reglements,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Enregistrer un règlement pour une facture
  create: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { error, value } = reglementSchema.validate(req.body);
    if (error) throw error;

    const [factures] = await db.query("SELECT id_facture FROM factures WHERE id_facture = ?", [id]);
    if (!factures.length) {
      throw new AppError("Facture non trouvée", 404, "FACTURE_NOT_FOUND");
    }

    const [result] = await db.query("INSERT INTO reglements SET ?", [
      { ...value, id_facture: id },
    ]);

    const [reglements] = await db.query(`${baseSelect} AND r.id_reglement = ?`, [result.insertId]);
    res.status(201).json(reglements[0]);
  }),

  // Supprimer un règlement (corrige une saisie erronée, déverrouille la facture s'il n'en reste aucun)
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;
    const [result] = await db.query("DELETE FROM reglements WHERE id_reglement = ?", [id]);
    if (result.affectedRows === 0) {
      throw new AppError("Règlement non trouvé", 404, "REGLEMENT_NOT_FOUND");
    }
    res.status(204).send();
  }),
};

module.exports = reglementsController;
