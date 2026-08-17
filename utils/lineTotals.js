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

// Décompose un total HT en HT / taux / montant TVA / TTC.
function computeDocumentTotals(totalHt, tauxTva) {
  const taux = Number(tauxTva ?? 0);
  const montantTva = Number(((totalHt * taux) / 100).toFixed(2));
  return {
    total_ht: Number(totalHt.toFixed(2)),
    taux_tva: taux,
    montant_tva: montantTva,
    total_ttc: Number((totalHt + montantTva).toFixed(2)),
  };
}

module.exports = { computeSuperficie, computeTotal, computeDocumentTotals };
