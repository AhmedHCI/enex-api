// Construit le payload attendu par generateDocumentPdf à partir d'une ligne
// devis ou facture (structure identique grâce à des baseSelect miroirs).
function buildPdfPayload(record, { label, numero, date }) {
  return {
    label,
    numero,
    date,
    notes: record.notes,
    prestations: record.prestations,
    totalHtBrut: record.total_ht_brut,
    remise: record.remise,
    montantRemise: record.montant_remise,
    totalHt: record.total_ht,
    tauxTva: record.taux_tva,
    montantTva: record.montant_tva,
    totalTtc: record.total_ttc,
    apporteur:
      record.apporteur_nom || record.apporteur_nom_societe
        ? {
            nom: record.apporteur_nom,
            prenom: record.apporteur_prenom,
            nomSociete: record.apporteur_nom_societe,
          }
        : null,
    estReglee: record.est_reglee || false,
    solde: record.solde,
    reglements: record.reglements || [],
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
