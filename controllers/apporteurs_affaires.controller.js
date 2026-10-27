const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const apporteurSchema = Joi.object({
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
  commission: Joi.number().min(0).max(100).allow(null),
  information: Joi.string().allow("", null),
});

const apporteurUpdateSchema = apporteurSchema.fork(["nom"], (field) =>
  field.optional()
);

const apporteursController = {
  // Récupérer tous les apporteurs d'affaires (recherche + pagination)
  getAll: catchAsync(async (req, res) => {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = "SELECT * FROM apporteurs_affaires WHERE 1=1";
    const params = [];

    if (search) {
      query +=
        " AND (nom LIKE ? OR prenom LIKE ? OR nom_societe LIKE ? OR email LIKE ? OR numero_siret LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countResult] = await db.query(
      query.replace("SELECT *", "SELECT COUNT(*) as total"),
      params
    );
    const total = countResult[0].total;

    query += " ORDER BY nom_societe ASC, nom ASC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    const [apporteurs] = await db.query(query, params);

    res.json({
      apporteurs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Récupérer un apporteur d'affaires par ID
  getById: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [apporteurs] = await db.query(
      "SELECT * FROM apporteurs_affaires WHERE id_apporteur = ?",
      [id]
    );

    if (!apporteurs.length) {
      throw new AppError("Apporteur d'affaires non trouvé", 404, "APPORTEUR_NOT_FOUND");
    }

    res.json(apporteurs[0]);
  }),

  // Créer un nouvel apporteur d'affaires
  create: catchAsync(async (req, res) => {
    const { error, value } = apporteurSchema.validate(req.body);
    if (error) throw error;

    const [result] = await db.query("INSERT INTO apporteurs_affaires SET ?", [value]);

    const [apporteurs] = await db.query(
      "SELECT * FROM apporteurs_affaires WHERE id_apporteur = ?",
      [result.insertId]
    );

    res.status(201).json(apporteurs[0]);
  }),

  // Mettre à jour un apporteur d'affaires
  update: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { error, value } = apporteurUpdateSchema.validate(req.body);
    if (error) throw error;

    const [existing] = await db.query(
      "SELECT id_apporteur FROM apporteurs_affaires WHERE id_apporteur = ?",
      [id]
    );
    if (!existing.length) {
      throw new AppError("Apporteur d'affaires non trouvé", 404, "APPORTEUR_NOT_FOUND");
    }

    await db.query("UPDATE apporteurs_affaires SET ? WHERE id_apporteur = ?", [
      { ...value, updated_at: new Date() },
      id,
    ]);

    const [apporteurs] = await db.query(
      "SELECT * FROM apporteurs_affaires WHERE id_apporteur = ?",
      [id]
    );

    res.json(apporteurs[0]);
  }),

  // Supprimer un apporteur d'affaires
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM apporteurs_affaires WHERE id_apporteur = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      throw new AppError("Apporteur d'affaires non trouvé", 404, "APPORTEUR_NOT_FOUND");
    }

    res.status(204).send();
  }),
};

module.exports = apporteursController;
