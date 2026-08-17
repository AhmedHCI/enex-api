const fs = require("fs");
const PDFDocument = require("pdfkit");

function formatDate(value) {
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatNumber(value) {
  return Number(value ?? 0).toFixed(2).replace(/\.00$/, "");
}

function formatEuro(value) {
  if (value == null) return "—";
  return `${formatNumber(value)} €`;
}

function formatAddress(adresse, cp, ville) {
  const cpVille = [cp, ville].filter(Boolean).join(" ");
  return [adresse, cpVille].filter(Boolean).join(", ");
}

function clientLine(client) {
  const identite = [client.prenom, client.nom].filter(Boolean).join(" ");
  if (client.nomSociete) {
    return identite ? `${client.nomSociete} (${identite})` : client.nomSociete;
  }
  return identite || "—";
}

function supportDims(support) {
  if (support.longueur != null && support.largeur != null) {
    return `${Number(support.longueur)} × ${Number(support.largeur)} m`;
  }
  if (support.superficie != null) {
    return `${Number(support.superficie)} m²`;
  }
  return null;
}

/// Génère le PDF d'un devis ou d'une facture (même structure de document).
/// payload = { label: "Devis"|"Facture", numero, date, notes, prestations, total,
///             chantier: { adresse, cp, ville }, client: { nom, prenom, nomSociete, adresse, cp, ville, telephone, portable, email } }
function generateDocumentPdf(payload, societe, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);

    // En-tête société (letterhead)
    if (societe) {
      doc.fontSize(18).fillColor("#1a1a1a").text(societe.nom || "");
      if (societe.activite) {
        doc.fontSize(9).fillColor("#666").text(societe.activite);
      }
      doc.moveDown(0.3);

      doc.fontSize(9).fillColor("#555");
      const adresseLine = formatAddress(societe.adresse, societe.cp, societe.ville);
      if (adresseLine) doc.text(adresseLine);

      const contact = [
        societe.telephone ? `Tél : ${societe.telephone}` : null,
        societe.portable ? `Port : ${societe.portable}` : null,
      ].filter(Boolean);
      if (contact.length) doc.text(contact.join("   —   "));

      const legal = [
        societe.rcs ? `RCS ${societe.rcs}` : null,
        societe.naf ? `NAF ${societe.naf}` : null,
        societe.tva != null ? `N° TVA : ${societe.tva}` : null,
      ].filter(Boolean);
      if (legal.length) doc.text(legal.join("   —   "));
    } else {
      doc.fontSize(18).fillColor("#1a1a1a").text(payload.label);
    }
    doc.moveDown(1.5);

    doc.fillColor("#000").fontSize(16).text(`${payload.label} n°${payload.numero}`);
    doc.fontSize(10).fillColor("#333").text(`Date : ${formatDate(payload.date)}`);
    doc.moveDown();

    doc.fontSize(12).fillColor("#000").text("Client", { underline: true });
    doc.fontSize(10).fillColor("#333").text(clientLine(payload.client));
    const clientAdresseLine = formatAddress(payload.client.adresse, payload.client.cp, payload.client.ville);
    if (clientAdresseLine) doc.text(clientAdresseLine);
    const clientContact = [
      payload.client.telephone ? `Tél : ${payload.client.telephone}` : null,
      payload.client.portable ? `Port : ${payload.client.portable}` : null,
      payload.client.email || null,
    ].filter(Boolean);
    if (clientContact.length) doc.text(clientContact.join("   —   "));
    doc.moveDown(0.5);

    doc.fontSize(12).fillColor("#000").text("Lieu d'intervention", { underline: true });
    doc.fontSize(10).fillColor("#333").text(
      formatAddress(payload.chantier.adresse, payload.chantier.cp, payload.chantier.ville) || "—"
    );
    doc.moveDown();

    payload.prestations.forEach((prestation) => {
      doc.fontSize(13).fillColor("#1a1a1a").text(prestation.nom_prestation || "Prestation");
      doc.moveDown(0.2);

      prestation.supports.forEach((support) => {
        const dims = supportDims(support);
        const priceInfo = support.prix_m2 != null ? `${formatEuro(support.prix_m2)}/m²` : null;
        const total = support.total != null ? formatEuro(support.total) : null;
        const detail = [dims, priceInfo, total].filter(Boolean).join(" — ");
        doc.fontSize(10).fillColor("#333").text(
          `•  ${support.type_support || "Support"}${detail ? "  (" + detail + ")" : ""}`
        );
      });

      doc.fontSize(10).fillColor("#000").text(`Sous-total : ${formatEuro(prestation.sous_total)}`, {
        align: "right",
      });
      doc.moveDown();
    });

    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#333").text(`Total HT : ${formatEuro(payload.totalHt)}`, { align: "right" });
    doc.text(`TVA (${formatNumber(payload.tauxTva)} %) : ${formatEuro(payload.montantTva)}`, {
      align: "right",
    });
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor("#000").text(`Total TTC : ${formatEuro(payload.totalTtc)}`, {
      align: "right",
    });

    if (payload.notes) {
      doc.moveDown();
      doc.fontSize(12).fillColor("#000").text("Notes", { underline: true });
      doc.fontSize(10).fillColor("#333").text(payload.notes);
    }

    if (payload.signatureImagePath) {
      doc.moveDown(1.5);
      doc.fontSize(10).fillColor("#333").text("Signature du client :", { align: "right" });
      doc.moveDown(0.3);
      doc.image(payload.signatureImagePath, doc.page.width - doc.page.margins.right - 150, doc.y, {
        width: 150,
      });
    }

    doc.end();
  });
}

module.exports = { generateDocumentPdf };
