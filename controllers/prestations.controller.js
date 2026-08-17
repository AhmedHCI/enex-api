const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const prestationSchema = Joi.object({
  nom: Joi.string().max(150).required(),
});

const prestationsController = {
  // Récupérer toutes les prestations (recherche + pagination)
  getAll: catchAsync(async (req, res) => {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = "SELECT * FROM prestations WHERE 1=1";
    const params = [];

    if (search) {
      query += " AND nom LIKE ?";
      params.push(`%${search}%`);
    }

    const [countResult] = await db.query(
      query.replace("SELECT *", "SELECT COUNT(*) as total"),
      params
    );
    const total = countResult[0].total;

    query += " ORDER BY nom ASC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    const [prestations] = await db.query(query, params);

    res.json({
      prestations,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Récupérer une prestation par ID
  getById: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [prestations] = await db.query("SELECT * FROM prestations WHERE id_prestation = ?", [id]);

    if (!prestations.length) {
      throw new AppError("Prestation non trouvée", 404, "PRESTATION_NOT_FOUND");
    }

    res.json(prestations[0]);
  }),

  // Créer une nouvelle prestation
  create: catchAsync(async (req, res) => {
    const { error, value } = prestationSchema.validate(req.body);
    if (error) throw error;

    const [result] = await db.query("INSERT INTO prestations SET ?", [value]);

    const [prestations] = await db.query("SELECT * FROM prestations WHERE id_prestation = ?", [
      result.insertId,
    ]);

    res.status(201).json(prestations[0]);
  }),

  // Mettre à jour une prestation
  update: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { error, value } = prestationSchema.validate(req.body);
    if (error) throw error;

    const [existing] = await db.query("SELECT id_prestation FROM prestations WHERE id_prestation = ?", [id]);
    if (!existing.length) {
      throw new AppError("Prestation non trouvée", 404, "PRESTATION_NOT_FOUND");
    }

    await db.query("UPDATE prestations SET ? WHERE id_prestation = ?", [
      { ...value, updated_at: new Date() },
      id,
    ]);

    const [prestations] = await db.query("SELECT * FROM prestations WHERE id_prestation = ?", [id]);

    res.json(prestations[0]);
  }),

  // Supprimer une prestation
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM prestations WHERE id_prestation = ?", [id]);

    if (result.affectedRows === 0) {
      throw new AppError("Prestation non trouvée", 404, "PRESTATION_NOT_FOUND");
    }

    res.status(204).send();
  }),
};

module.exports = prestationsController;
