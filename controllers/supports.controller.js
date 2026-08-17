const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const supportSchema = Joi.object({
  type_support: Joi.string().max(100).required(),
  information: Joi.string().allow("", null),
  prix_m2: Joi.number().min(0).allow(null),
});

const supportUpdateSchema = supportSchema.fork(["type_support"], (field) => field.optional());

const supportsController = {
  // Récupérer tous les supports (recherche + pagination)
  getAll: catchAsync(async (req, res) => {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = "SELECT * FROM supports WHERE 1=1";
    const params = [];

    if (search) {
      query += " AND type_support LIKE ?";
      params.push(`%${search}%`);
    }

    const [countResult] = await db.query(
      query.replace("SELECT *", "SELECT COUNT(*) as total"),
      params
    );
    const total = countResult[0].total;

    query += " ORDER BY type_support ASC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    const [supports] = await db.query(query, params);

    res.json({
      supports,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Récupérer un support par ID
  getById: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [supports] = await db.query("SELECT * FROM supports WHERE id_support = ?", [id]);

    if (!supports.length) {
      throw new AppError("Support non trouvé", 404, "SUPPORT_NOT_FOUND");
    }

    res.json(supports[0]);
  }),

  // Créer un nouveau support
  create: catchAsync(async (req, res) => {
    const { error, value } = supportSchema.validate(req.body);
    if (error) throw error;

    const [result] = await db.query("INSERT INTO supports SET ?", [value]);

    const [supports] = await db.query("SELECT * FROM supports WHERE id_support = ?", [result.insertId]);

    res.status(201).json(supports[0]);
  }),

  // Mettre à jour un support
  update: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { error, value } = supportUpdateSchema.validate(req.body);
    if (error) throw error;

    const [existing] = await db.query("SELECT id_support FROM supports WHERE id_support = ?", [id]);
    if (!existing.length) {
      throw new AppError("Support non trouvé", 404, "SUPPORT_NOT_FOUND");
    }

    await db.query("UPDATE supports SET ? WHERE id_support = ?", [
      { ...value, updated_at: new Date() },
      id,
    ]);

    const [supports] = await db.query("SELECT * FROM supports WHERE id_support = ?", [id]);

    res.json(supports[0]);
  }),

  // Supprimer un support
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM supports WHERE id_support = ?", [id]);

    if (result.affectedRows === 0) {
      throw new AppError("Support non trouvé", 404, "SUPPORT_NOT_FOUND");
    }

    res.status(204).send();
  }),
};

module.exports = supportsController;
