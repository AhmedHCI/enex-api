const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const TYPES_HABITATION = ["appartement", "pavillon", "societe"];

const chantierSchema = Joi.object({
  id_client: Joi.number().integer().required(),
  adresse: Joi.string().max(255).allow("", null),
  cp: Joi.string().max(10).allow("", null),
  ville: Joi.string().max(100).allow("", null),
  type_habitation: Joi.string().valid(...TYPES_HABITATION).required(),
  surface_chantier: Joi.number().min(0).allow(null),
});

const chantierUpdateSchema = chantierSchema.fork(
  ["id_client", "type_habitation"],
  (field) => field.optional()
);

const baseSelect = `
  SELECT c.*, cl.nom AS client_nom, cl.prenom AS client_prenom, cl.nom_societe AS client_nom_societe
  FROM chantiers c
  JOIN clients cl ON cl.id_client = c.id_client
  WHERE 1=1
`;

const chantiersController = {
  // Récupérer tous les chantiers (recherche + pagination + filtre client)
  getAll: catchAsync(async (req, res) => {
    const { search, id_client, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = baseSelect;
    const params = [];

    if (id_client) {
      query += " AND c.id_client = ?";
      params.push(id_client);
    }

    if (search) {
      query += " AND (c.adresse LIKE ? OR c.ville LIKE ? OR cl.nom LIKE ? OR cl.nom_societe LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countResult] = await db.query(
      query.replace("SELECT c.*, cl.nom AS client_nom, cl.prenom AS client_prenom, cl.nom_societe AS client_nom_societe", "SELECT COUNT(*) as total"),
      params
    );
    const total = countResult[0].total;

    query += " ORDER BY c.created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    const [chantiers] = await db.query(query, params);

    res.json({
      chantiers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Récupérer un chantier par ID
  getById: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [chantiers] = await db.query(`${baseSelect} AND c.id_chantier = ?`, [id]);
    if (!chantiers.length) {
      throw new AppError("Chantier non trouvé", 404, "CHANTIER_NOT_FOUND");
    }

    res.json(chantiers[0]);
  }),

  // Créer un nouveau chantier
  create: catchAsync(async (req, res) => {
    const { error, value } = chantierSchema.validate(req.body);
    if (error) throw error;

    const [result] = await db.query("INSERT INTO chantiers SET ?", [value]);

    const [chantiers] = await db.query(`${baseSelect} AND c.id_chantier = ?`, [result.insertId]);
    res.status(201).json(chantiers[0]);
  }),

  // Mettre à jour un chantier
  update: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { error, value } = chantierUpdateSchema.validate(req.body);
    if (error) throw error;

    const [existing] = await db.query("SELECT id_chantier FROM chantiers WHERE id_chantier = ?", [id]);
    if (!existing.length) {
      throw new AppError("Chantier non trouvé", 404, "CHANTIER_NOT_FOUND");
    }

    await db.query("UPDATE chantiers SET ? WHERE id_chantier = ?", [
      { ...value, updated_at: new Date() },
      id,
    ]);

    const [chantiers] = await db.query(`${baseSelect} AND c.id_chantier = ?`, [id]);
    res.json(chantiers[0]);
  }),

  // Supprimer un chantier
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM chantiers WHERE id_chantier = ?", [id]);

    if (result.affectedRows === 0) {
      throw new AppError("Chantier non trouvé", 404, "CHANTIER_NOT_FOUND");
    }

    res.status(204).send();
  }),
};

module.exports = chantiersController;
