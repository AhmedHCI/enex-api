const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const fournisseurSchema = Joi.object({
  contact: Joi.string().max(100).required(),
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

const fournisseurUpdateSchema = fournisseurSchema.fork(["contact"], (field) =>
  field.optional()
);

const fournisseursController = {
  // Récupérer tous les fournisseurs (recherche + pagination)
  getAll: catchAsync(async (req, res) => {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = "SELECT * FROM fournisseurs WHERE 1=1";
    const params = [];

    if (search) {
      query +=
        " AND (contact LIKE ? OR nom_societe LIKE ? OR email LIKE ? OR numero_siret LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countResult] = await db.query(
      query.replace("SELECT *", "SELECT COUNT(*) as total"),
      params
    );
    const total = countResult[0].total;

    query += " ORDER BY nom_societe ASC, contact ASC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    const [fournisseurs] = await db.query(query, params);

    res.json({
      fournisseurs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Récupérer un fournisseur par ID
  getById: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [fournisseurs] = await db.query(
      "SELECT * FROM fournisseurs WHERE id_fournisseur = ?",
      [id]
    );

    if (!fournisseurs.length) {
      throw new AppError("Fournisseur non trouvé", 404, "FOURNISSEUR_NOT_FOUND");
    }

    res.json(fournisseurs[0]);
  }),

  // Créer un nouveau fournisseur
  create: catchAsync(async (req, res) => {
    const { error, value } = fournisseurSchema.validate(req.body);
    if (error) throw error;

    const [result] = await db.query("INSERT INTO fournisseurs SET ?", [value]);

    const [fournisseurs] = await db.query(
      "SELECT * FROM fournisseurs WHERE id_fournisseur = ?",
      [result.insertId]
    );

    res.status(201).json(fournisseurs[0]);
  }),

  // Mettre à jour un fournisseur
  update: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { error, value } = fournisseurUpdateSchema.validate(req.body);
    if (error) throw error;

    const [existing] = await db.query(
      "SELECT id_fournisseur FROM fournisseurs WHERE id_fournisseur = ?",
      [id]
    );
    if (!existing.length) {
      throw new AppError("Fournisseur non trouvé", 404, "FOURNISSEUR_NOT_FOUND");
    }

    await db.query("UPDATE fournisseurs SET ? WHERE id_fournisseur = ?", [
      { ...value, updated_at: new Date() },
      id,
    ]);

    const [fournisseurs] = await db.query(
      "SELECT * FROM fournisseurs WHERE id_fournisseur = ?",
      [id]
    );

    res.json(fournisseurs[0]);
  }),

  // Supprimer un fournisseur
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM fournisseurs WHERE id_fournisseur = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      throw new AppError("Fournisseur non trouvé", 404, "FOURNISSEUR_NOT_FOUND");
    }

    res.status(204).send();
  }),
};

module.exports = fournisseursController;
