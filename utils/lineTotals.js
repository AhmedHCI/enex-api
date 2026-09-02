function computeSuperficie(support) {
  if (support.superficie != null) return Number(support.superficie);
  if (support.longueur != null && support.largeur != null) {
    return Number((support.longueur * support.largeur).toFixed(2));
  }
  return null;
}

function computeTotal(support) {
  const superficie = computeSuperficie(support);
  if (superficie == null || support.prix_m2 == null) return null;
  return Number((superficie * support.prix_m2).toFixed(2));
}

// Décompose un total HT brut (avant remise) en remise / HT net / TVA / TTC.
// La remise (%) s'applique sur le HT avant calcul de la TVA.
function computeDocumentTotals(totalHtBrut, tauxTva, remise) {
  const tauxRemise = Number(remise ?? 0);
  const montantRemise = Number(((totalHtBrut * tauxRemise) / 100).toFixed(2));
  const totalHt = Number((totalHtBrut - montantRemise).toFixed(2));
  const taux = Number(tauxTva ?? 0);
  const montantTva = Number(((totalHt * taux) / 100).toFixed(2));
  return {
    total_ht_brut: Number(totalHtBrut.toFixed(2)),
    remise: tauxRemise > 0 ? tauxRemise : null,
    montant_remise: tauxRemise > 0 ? montantRemise : null,
    total_ht: totalHt,
    taux_tva: taux,
    montant_tva: montantTva,
    total_ttc: Number((totalHt + montantTva).toFixed(2)),
  };
}

module.exports = { computeSuperficie, computeTotal, computeDocumentTotals };
