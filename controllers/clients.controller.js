const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const clientSchema = Joi.object({
  nom: Joi.string().max(100).required(),
  prenom: Joi.string().max(100).allow("", null),
  nom_societe: Joi.string().max(150).allow("", null),
  adresse: Joi.string().max(255).allow("", null),
  cp: Joi.string().max(10).allow("", null),
  ville: Joi.string().max(100).allow("", null),
  telephone: Joi.string().max(20).allow("", null),
  portable: Joi.string().max(20).allow("", null),
  email: Joi.string().email().max(150).allow("", null),
  numero_siret: Joi.string().max(20).allow("", null),
  numero_tva: Joi.string().max(20).allow("", null),
  information: Joi.string().allow("", null),
});

const clientUpdateSchema = clientSchema.fork(["nom"], (field) =>
  field.optional()
);

const clientsController = {
  // Récupérer tous les clients (recherche + pagination)
  getAll: catchAsync(async (req, res) => {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = "SELECT * FROM clients WHERE 1=1";
    const params = [];

    if (search) {
      query +=
        " AND (nom LIKE ? OR prenom LIKE ? OR nom_societe LIKE ? OR email LIKE ? OR numero_siret LIKE ?)";
      params.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
    }

    const [countResult] = await db.query(
      query.replace("SELECT *", "SELECT COUNT(*) as total"),
      params
    );
    const total = countResult[0].total;

    query += " ORDER BY nom ASC, prenom ASC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    const [clients] = await db.query(query, params);

    res.json({
      clients,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Récupérer un client par ID
  getById: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [clients] = await db.query(
      "SELECT * FROM clients WHERE id_client = ?",
      [id]
    );

    if (!clients.length) {
      throw new AppError("Client non trouvé", 404, "CLIENT_NOT_FOUND");
    }

    res.json(clients[0]);
  }),

  // Créer un nouveau client
  create: catchAsync(async (req, res) => {
    const { error, value } = clientSchema.validate(req.body);
    if (error) throw error;

    const [result] = await db.query("INSERT INTO clients SET ?", [value]);

    const [clients] = await db.query(
      "SELECT * FROM clients WHERE id_client = ?",
      [result.insertId]
    );

    res.status(201).json(clients[0]);
  }),

  // Mettre à jour un client
  update: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { error, value } = clientUpdateSchema.validate(req.body);
    if (error) throw error;

    const [existing] = await db.query(
      "SELECT id_client FROM clients WHERE id_client = ?",
      [id]
    );
    if (!existing.length) {
      throw new AppError("Client non trouvé", 404, "CLIENT_NOT_FOUND");
    }

    await db.query("UPDATE clients SET ? WHERE id_client = ?", [
      { ...value, updated_at: new Date() },
      id,
    ]);

    const [clients] = await db.query(
      "SELECT * FROM clients WHERE id_client = ?",
      [id]
    );

    res.json(clients[0]);
  }),

  // Supprimer un client
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM clients WHERE id_client = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      throw new AppError("Client non trouvé", 404, "CLIENT_NOT_FOUND");
    }

    res.status(204).send();
  }),
};

module.exports = clientsController;
