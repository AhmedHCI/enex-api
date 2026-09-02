const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const societeSchema = Joi.object({
  nom: Joi.string().max(150).required(),
  adresse: Joi.string().max(255).allow("", null),
  cp: Joi.string().max(10).allow("", null),
  ville: Joi.string().max(100).allow("", null),
  rcs: Joi.string().max(50).allow("", null),
  naf: Joi.string().max(10).allow("", null),
  telephone: Joi.string().max(20).allow("", null),
  portable: Joi.string().max(20).allow("", null),
  email: Joi.string().email().max(150).allow("", null),
  tva: Joi.number().min(0).allow(null),
  marge: Joi.number().min(0).allow(null),
  jours_travail: Joi.number().integer().min(0).max(7).allow(null),
  activite: Joi.string().max(255).allow("", null),
  conditions_vente: Joi.string().allow("", null),
  banque: Joi.string().max(150).allow("", null),
  iban: Joi.string().max(34).allow("", null),
});

const societeController = {
  // Récupérer les informations de la société (ligne unique)
  get: catchAsync(async (req, res) => {
    const [rows] = await db.query("SELECT * FROM societe ORDER BY id_societe ASC LIMIT 1");
    if (!rows.length) {
      throw new AppError("Société non configurée", 404, "SOCIETE_NOT_FOUND");
    }
    res.json(rows[0]);
  }),

  // Mettre à jour les informations de la société (ligne unique)
  update: catchAsync(async (req, res) => {
    const { error, value } = societeSchema.validate(req.body);
    if (error) throw error;

    const [existing] = await db.query("SELECT id_societe FROM societe ORDER BY id_societe ASC LIMIT 1");
    if (!existing.length) {
      throw new AppError("Société non configurée", 404, "SOCIETE_NOT_FOUND");
    }

    await db.query("UPDATE societe SET ? WHERE id_societe = ?", [
      { ...value, updated_at: new Date() },
      existing[0].id_societe,
    ]);

    const [rows] = await db.query("SELECT * FROM societe WHERE id_societe = ?", [existing[0].id_societe]);
    res.json(rows[0]);
  }),
};

module.exports = societeController;
