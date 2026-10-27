const Joi = require("joi");
const db = require("../config/database");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const agenceSchema = Joi.object({
  nom: Joi.string().max(150).required(),
  contact: Joi.string().max(100).allow("", null),
  adresse: Joi.string().max(255).allow("", null),
  cp: Joi.string().max(10).allow("", null),
  ville: Joi.string().max(100).allow("", null),
  telephone: Joi.string().max(20).allow("", null),
  portable: Joi.string().max(20).allow("", null),
  email: Joi.string().email().max(150).allow("", null),
  numero_siret: Joi.string().max(20).allow("", null),
  information: Joi.string().allow("", null),
  site_internet: Joi.string().max(255).allow("", null),
  latitude: Joi.number().allow(null),
  longitude: Joi.number().allow(null),
  visite: Joi.boolean(),
  rdv: Joi.boolean(),
  date_rdv: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
});

const agenceUpdateSchema = agenceSchema.fork(["nom"], (field) => field.optional());

const RECHERCHE_LIMITE_MENSUELLE = 5000;

async function getMonthlySearchCount() {
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(nombre), 0) AS total
     FROM agences_recherches_log
     WHERE YEAR(date_recherche) = YEAR(CURDATE()) AND MONTH(date_recherche) = MONTH(CURDATE())`
  );
  return Number(rows[0].total);
}

// Vérifie le quota du mois en cours (table agences_recherches_log, une ligne
// par jour) et incrémente le compteur du jour si la limite n'est pas atteinte.
// Lève une AppError 429 si la limite mensuelle est dépassée.
async function checkAndIncrementSearchQuota() {
  const totalCeMois = await getMonthlySearchCount();

  if (totalCeMois >= RECHERCHE_LIMITE_MENSUELLE) {
    throw new AppError(
      `Limite mensuelle de ${RECHERCHE_LIMITE_MENSUELLE} recherches atteinte. Réessaie le mois prochain.`,
      429,
      "SEARCH_QUOTA_EXCEEDED"
    );
  }

  await db.query(
    `INSERT INTO agences_recherches_log (date_recherche, nombre) VALUES (CURDATE(), 1)
     ON DUPLICATE KEY UPDATE nombre = nombre + 1`
  );

  return totalCeMois + 1;
}

// Un seul appel Nearby Search plafonne à 20 résultats, quel que soit le rayon
// demandé. Pour couvrir tout le rayon, on interroge une grille de sous-points
// (avec chevauchement) et on fusionne les résultats en dédoublonnant par id.
async function searchNearbyOnce(lat, lng, radiusMeters, apiKey) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.location,places.addressComponents",
    },
    body: JSON.stringify({
      includedTypes: ["real_estate_agency"],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new AppError(
      `Erreur Google Places : ${data.error?.message || res.statusText}`,
      502,
      "GOOGLE_PLACES_ERROR"
    );
  }

  return data.places || [];
}

// Génère une grille 3x3 de points centrés sur (lat, lng) : le centre, plus 8
// points autour espacés de ~2/3 du rayon, chacun interrogé avec un rayon plus
// petit (avec chevauchement) pour couvrir tout le disque de rayon d'origine.
function buildSearchGrid(lat, lng, radiusMeters) {
  const spacing = radiusMeters * 0.66;
  const subRadius = Math.min(radiusMeters, radiusMeters * 0.6);
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos((lat * Math.PI) / 180);

  const offsets = [
    [0, 0],
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  return offsets.map(([dx, dy]) => ({
    lat: lat + (dy * spacing) / metersPerDegreeLat,
    lng: lng + (dx * spacing) / metersPerDegreeLng,
    radius: subRadius,
  }));
}

async function fetchNearbyRealEstateAgencies(lat, lng, radiusMeters, apiKey) {
  const grid = buildSearchGrid(Number(lat), Number(lng), Number(radiusMeters));

  const results = await Promise.all(
    grid.map((point) => searchNearbyOnce(point.lat, point.lng, point.radius, apiKey))
  );

  const byId = new Map();
  for (const place of results.flat()) {
    if (!place.id || byId.has(place.id)) continue;
    const nom = place.displayName?.text || "(sans nom)";
    if (isLikelyNotRealEstateAgency(nom)) continue;
    const { ville, cp } = extractVilleEtCp(place.addressComponents);
    byId.set(place.id, {
      place_id: place.id,
      nom,
      adresse: place.formattedAddress || null,
      ville,
      cp,
      telephone: place.internationalPhoneNumber || place.nationalPhoneNumber || null,
      site_internet: place.websiteUri || null,
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
    });
  }

  return [...byId.values()];
}

// La ville n'est pas un champ séparé dans formattedAddress : on la récupère
// depuis les composants structurés de l'adresse (locality / postal_code).
function extractVilleEtCp(addressComponents) {
  if (!Array.isArray(addressComponents)) return { ville: null, cp: null };
  const locality = addressComponents.find((c) => c.types?.includes("locality"));
  const postalCode = addressComponents.find((c) => c.types?.includes("postal_code"));
  return {
    ville: locality?.longText || null,
    cp: postalCode?.longText || null,
  };
}

// Google classe parfois des commerces sans rapport sous "real_estate_agency"
// (coworking, camping, agences de voyage, bailleurs HLM, résidences
// étudiantes, data centers...). Filtre best-effort par mots-clés du nom.
const NON_AGENCE_KEYWORDS = [
  "wework", "wojo", "spaces cours", "buro club", "business center", "mundo-m",
  "morning,", "kwerk", "coworking",
  "camping",
  "voyages", "selectour",
  "hlm", "résidence étudiante", "residence etudiante", "fac-habitat", "espacil habitat",
  "logifac", "ehpad",
  "data center", "digital realty",
  "parc des expositions",
  "domiciliation",
];

function isLikelyNotRealEstateAgency(nom) {
  const lower = nom.toLowerCase();
  return NON_AGENCE_KEYWORDS.some((kw) => lower.includes(kw));
}

const agencesController = {
  // Quota restant de recherches Google Places pour le mois en cours (lecture
  // seule, n'incrémente pas le compteur).
  getSearchQuota: catchAsync(async (req, res) => {
    const utilisees = await getMonthlySearchCount();
    res.json({
      limite: RECHERCHE_LIMITE_MENSUELLE,
      utilisees,
      quota_restant: Math.max(0, RECHERCHE_LIMITE_MENSUELLE - utilisees),
    });
  }),

  // Recherche les agences immobilières autour d'une position (rayon en mètres,
  // 20 km par défaut) via Google Places, et les insère/rafraîchit en base.
  search: catchAsync(async (req, res) => {
    const { lat, lng, radius = 20000 } = req.query;
    if (!lat || !lng) {
      throw new AppError("Position (lat, lng) requise", 400, "POSITION_REQUIRED");
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new AppError("Clé Google Places non configurée sur le serveur", 500, "MISSING_API_KEY");
    }

    const rechercheNumero = await checkAndIncrementSearchQuota();

    const found = await fetchNearbyRealEstateAgencies(lat, lng, radius, apiKey);

    const ids = await Promise.all(
      found.map(async (place) => {
        const [existing] = await db.query(
          "SELECT id_agence FROM agences_immobilieres WHERE google_place_id = ?",
          [place.place_id]
        );

        if (existing.length) {
          // On rafraîchit les infos de base sans toucher à visite/rdv/date_rdv.
          await db.query(
            `UPDATE agences_immobilieres
             SET nom = ?, adresse = ?, ville = ?, cp = ?, telephone = ?, site_internet = ?, latitude = ?, longitude = ?, updated_at = ?
             WHERE id_agence = ?`,
            [
              place.nom,
              place.adresse,
              place.ville,
              place.cp,
              place.telephone,
              place.site_internet,
              place.latitude,
              place.longitude,
              new Date(),
              existing[0].id_agence,
            ]
          );
          return existing[0].id_agence;
        }

        const [result] = await db.query(
          `INSERT INTO agences_immobilieres (nom, adresse, ville, cp, telephone, site_internet, latitude, longitude, google_place_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            place.nom,
            place.adresse,
            place.ville,
            place.cp,
            place.telephone,
            place.site_internet,
            place.latitude,
            place.longitude,
            place.place_id,
          ]
        );
        return result.insertId;
      })
    );

    const quotaRestant = RECHERCHE_LIMITE_MENSUELLE - rechercheNumero;

    if (!ids.length) {
      return res.json({ count: 0, agences: [], quota_restant: quotaRestant });
    }

    const [agences] = await db.query(
      `SELECT * FROM agences_immobilieres WHERE id_agence IN (?) ORDER BY nom ASC`,
      [ids]
    );

    res.json({ count: agences.length, agences, quota_restant: quotaRestant });
  }),

  // Récupérer toutes les agences immobilières (recherche + filtre visite + pagination)
  getAll: catchAsync(async (req, res) => {
    const { search, visite, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = "SELECT * FROM agences_immobilieres WHERE 1=1";
    const params = [];

    if (search) {
      query += " AND (nom LIKE ? OR contact LIKE ? OR email LIKE ? OR ville LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (visite === "1" || visite === "true") {
      query += " AND visite = 1";
    } else if (visite === "0" || visite === "false") {
      query += " AND visite = 0";
    }

    const [countResult] = await db.query(
      query.replace("SELECT *", "SELECT COUNT(*) as total"),
      params
    );
    const total = countResult[0].total;

    query += " ORDER BY nom ASC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    const [agences] = await db.query(query, params);

    res.json({
      agences,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Récupérer une agence immobilière par ID
  getById: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [agences] = await db.query(
      "SELECT * FROM agences_immobilieres WHERE id_agence = ?",
      [id]
    );

    if (!agences.length) {
      throw new AppError("Agence immobilière non trouvée", 404, "AGENCE_NOT_FOUND");
    }

    res.json(agences[0]);
  }),

  // Créer une nouvelle agence immobilière
  create: catchAsync(async (req, res) => {
    const { error, value } = agenceSchema.validate(req.body);
    if (error) throw error;

    const [result] = await db.query("INSERT INTO agences_immobilieres SET ?", [value]);

    const [agences] = await db.query(
      "SELECT * FROM agences_immobilieres WHERE id_agence = ?",
      [result.insertId]
    );

    res.status(201).json(agences[0]);
  }),

  // Mettre à jour une agence immobilière
  update: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { error, value } = agenceUpdateSchema.validate(req.body);
    if (error) throw error;

    const [existing] = await db.query(
      "SELECT id_agence FROM agences_immobilieres WHERE id_agence = ?",
      [id]
    );
    if (!existing.length) {
      throw new AppError("Agence immobilière non trouvée", 404, "AGENCE_NOT_FOUND");
    }

    await db.query("UPDATE agences_immobilieres SET ? WHERE id_agence = ?", [
      { ...value, updated_at: new Date() },
      id,
    ]);

    const [agences] = await db.query(
      "SELECT * FROM agences_immobilieres WHERE id_agence = ?",
      [id]
    );

    res.json(agences[0]);
  }),

  // Supprimer une agence immobilière
  delete: catchAsync(async (req, res) => {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM agences_immobilieres WHERE id_agence = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      throw new AppError("Agence immobilière non trouvée", 404, "AGENCE_NOT_FOUND");
    }

    res.status(204).send();
  }),
};

module.exports = agencesController;
