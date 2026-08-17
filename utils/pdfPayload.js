// Construit le payload attendu par generateDocumentPdf à partir d'une ligne
// devis ou facture (structure identique grâce à des baseSelect miroirs).
function buildPdfPayload(record, { label, numero, date }) {
  return {
    label,
    numero,
    date,
    notes: record.notes,
    prestations: record.prestations,
    totalHt: record.total_ht,
    tauxTva: record.taux_tva,
    montantTva: record.montant_tva,
    totalTtc: record.total_ttc,
    chantier: {
      adresse: record.chantier_adresse,
      cp: record.chantier_cp,
      ville: record.chantier_ville,
    },
    client: {
      nom: record.client_nom,
      prenom: record.client_prenom,
      nomSociete: record.client_nom_societe,
      adresse: record.client_adresse,
      cp: record.client_cp,
      ville: record.client_ville,
      telephone: record.client_telephone,
      portable: record.client_portable,
      email: record.client_email,
    },
  };
}

module.exports = { buildPdfPayload };
