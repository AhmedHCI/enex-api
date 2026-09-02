const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const logoPath = path.join(__dirname, "..", "assets", "logo.png");

// Palette ENEX (vert de la charte, cf. lib/main.dart côté app).
const GREEN_DARK = "#1B5E20";
const GREEN = "#2E7D32";
const GREEN_LIGHT = "#C8E6C9";
const GREY_TEXT = "#333333";
const GREY_LIGHT = "#777777";
const GREY_RULE = "#DDDDDD";

const MARGIN = 50;

function formatDate(value) {
  // Si c'est déjà une chaîne "YYYY-MM-DD", on la découpe directement pour éviter
  // un aller-retour par un objet Date qui décalerait le jour selon le fuseau horaire.
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
  }
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
  const base = support.longueur != null && support.largeur != null
    ? `${Number(support.longueur)} × ${Number(support.largeur)} m`
    : support.superficie != null
    ? `${Number(support.superficie)} m²`
    : null;
  const hauteur = support.hauteur != null ? `H ${Number(support.hauteur)} m` : null;
  const parts = [base, hauteur].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

// Décorations vertes en coin de page (haut-gauche discret, bas-droite en L).
function drawCornerDecorations(doc) {
  const w = doc.page.width;
  const h = doc.page.height;

  doc.rect(0, 0, 16, 16).fill(GREEN);

  doc.rect(w - 130, h - 90, 130, 90).fill(GREEN_LIGHT);
  doc.rect(w - 70, h - 50, 70, 50).fill(GREEN);

  // pdfkit conserve la couleur de remplissage active pour le texte qui suit
  // (y compris un texte qui déborde automatiquement sur cette nouvelle page) :
  // on la réinitialise pour ne pas laisser le vert des décorations "fuiter".
  doc.fillColor(GREY_TEXT);
}

function drawHeader(doc, payload, societe) {
  const contentWidth = doc.page.width - MARGIN * 2;
  const topY = MARGIN;

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, MARGIN, topY, { width: 44 });
  }
  const nomX = MARGIN + (fs.existsSync(logoPath) ? 54 : 0);
  doc.fillColor(GREEN_DARK).font("Helvetica-Bold").fontSize(20).text((societe && societe.nom) || payload.label, nomX, topY + 6);
  if (societe && societe.activite) {
    doc.font("Helvetica").fontSize(8).fillColor(GREY_LIGHT).text(societe.activite.toUpperCase(), nomX, topY + 30, {
      characterSpacing: 1,
    });
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(38)
    .fillColor("#111111")
    .text(payload.label.toUpperCase(), MARGIN, topY, { width: contentWidth, align: "right" });

  const afterHeaderY = topY + 70;
  doc.y = afterHeaderY;

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  doc.text(`DATE : ${formatDate(payload.date)}`, MARGIN, doc.y);

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#111111")
    .text(`${payload.label.toUpperCase()} N° : ${payload.numero}`, MARGIN, afterHeaderY - 3, {
      width: contentWidth,
      align: "right",
    });

  doc.moveDown(0.8);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(doc.page.width - MARGIN, doc.y)
    .lineWidth(1.2)
    .strokeColor("#111111")
    .stroke();
  doc.moveDown(1);
}

function drawParties(doc, payload, societe) {
  const contentWidth = doc.page.width - MARGIN * 2;
  const colWidth = contentWidth / 2;
  const startY = doc.y;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth;

  doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN_DARK);
  doc.text("ÉMETTEUR", leftX, startY, { width: colWidth - 10 });
  doc.text("DESTINATAIRE", rightX, startY, { width: colWidth - 10, align: "right" });
  doc.moveDown(0.5);

  const bodyY = doc.y;
  doc.font("Helvetica").fontSize(9).fillColor(GREY_TEXT);

  const emetteurLines = societe
    ? [
        societe.nom,
        formatAddress(societe.adresse, societe.cp, societe.ville),
        societe.telephone ? `Tél : ${societe.telephone}` : null,
        societe.email || null,
        societe.tva != null ? `N° TVA : ${societe.tva}` : null,
      ].filter(Boolean)
    : [];
  doc.text(emetteurLines.join("\n"), leftX, bodyY, { width: colWidth - 10 });

  const destinataireLines = [
    clientLine(payload.client),
    formatAddress(payload.client.adresse, payload.client.cp, payload.client.ville),
    payload.client.telephone ? `Tél : ${payload.client.telephone}` : null,
    payload.client.portable ? `Port : ${payload.client.portable}` : null,
    payload.client.email || null,
  ].filter(Boolean);
  doc.text(destinataireLines.join("\n"), rightX, bodyY, { width: colWidth - 10, align: "right" });

  const usedHeight = Math.max(
    doc.heightOfString(emetteurLines.join("\n"), { width: colWidth - 10 }),
    doc.heightOfString(destinataireLines.join("\n"), { width: colWidth - 10 })
  );
  doc.y = bodyY + usedHeight;
  doc.moveDown(0.8);

  const lieu = formatAddress(payload.chantier.adresse, payload.chantier.cp, payload.chantier.ville);
  if (lieu) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN_DARK).text("LIEU D'INTERVENTION", leftX);
    doc.font("Helvetica").fontSize(9).fillColor(GREY_TEXT).text(lieu);
    doc.moveDown(0.8);
  }
}

// Aplatit prestations/supports en lignes de tableau (Description / PU / Quantité / Total).
function buildRows(prestations) {
  const rows = [];
  prestations.forEach((prestation) => {
    (prestation.supports || []).forEach((support) => {
      rows.push({
        description: `${prestation.nom_prestation || "Prestation"} — ${support.type_support || "Support"}`,
        prixUnitaire: support.prix_m2 != null ? `${formatEuro(support.prix_m2)}/m²` : "—",
        quantite: supportDims(support),
        total: support.total != null ? formatEuro(support.total) : "—",
      });
    });
    if (!prestation.supports || !prestation.supports.length) {
      rows.push({
        description: prestation.nom_prestation || "Prestation",
        prixUnitaire: "—",
        quantite: "—",
        total: prestation.sous_total != null ? formatEuro(prestation.sous_total) : "—",
      });
    }
  });
  return rows;
}

function drawTable(doc, prestations) {
  const contentWidth = doc.page.width - MARGIN * 2;
  const cols = [
    { key: "description", label: "Description", width: contentWidth * 0.45, align: "left" },
    { key: "prixUnitaire", label: "Prix Unitaire", width: contentWidth * 0.2, align: "right" },
    { key: "quantite", label: "Quantité", width: contentWidth * 0.15, align: "right" },
    { key: "total", label: "Total", width: contentWidth * 0.2, align: "right" },
  ];

  function colX(index) {
    let x = MARGIN;
    for (let i = 0; i < index; i++) x += cols[i].width;
    return x;
  }

  function ensureSpace(minHeight) {
    if (doc.y + minHeight > doc.page.height - MARGIN - 110) {
      doc.addPage();
      doc.y = MARGIN;
      drawHeaderRow();
      return true;
    }
    return false;
  }

  function drawHeaderRow() {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
    const y = doc.y;
    cols.forEach((col, i) => {
      doc.text(col.label, colX(i), y, { width: col.width, align: col.align });
    });
    doc.moveDown(0.5);
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(doc.page.width - MARGIN, doc.y)
      .lineWidth(1)
      .strokeColor("#111111")
      .stroke();
    doc.moveDown(0.4);
  }

  drawHeaderRow();

  const rows = buildRows(prestations);
  rows.forEach((row) => {
    doc.font("Helvetica").fontSize(9).fillColor(GREY_TEXT);
    const rowHeight = Math.max(
      ...cols.map((col) => doc.heightOfString(String(row[col.key]), { width: col.width }))
    );
    ensureSpace(rowHeight + 20);
    doc.font("Helvetica").fontSize(9).fillColor(GREY_TEXT);
    const y = doc.y;
    cols.forEach((col, i) => {
      doc.text(String(row[col.key]), colX(i), y, { width: col.width, align: col.align });
    });
    doc.y = y + rowHeight + 6;
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(doc.page.width - MARGIN, doc.y)
      .lineWidth(0.5)
      .strokeColor(GREY_RULE)
      .stroke();
    doc.moveDown(0.5);
  });
}

function drawTotalsAndReglement(doc, payload, societe) {
  const contentWidth = doc.page.width - MARGIN * 2;
  const reglementWidth = contentWidth * 0.55;
  const totalsWidth = contentWidth * 0.4;
  const totalsX = doc.page.width - MARGIN - totalsWidth;
  const startY = doc.y + 10;

  if (doc.page.height - startY < 140) {
    doc.addPage();
    doc.y = MARGIN;
  }
  const y0 = doc.y + 10;

  function totalLine(label, value, y, bold) {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor("#111111");
    doc.text(label, totalsX, y, { width: totalsWidth * 0.5, align: "right" });
    doc.text(value, totalsX + totalsWidth * 0.5 + 8, y, { width: totalsWidth * 0.5 - 8, align: "right" });
  }

  let y = y0;
  totalLine("TOTAL HT :", formatEuro(payload.totalHt), y, false);
  y += 18;
  totalLine(`TVA (${formatNumber(payload.tauxTva)} %) :`, formatEuro(payload.montantTva), y, false);
  y += 18;
  doc
    .moveTo(totalsX, y)
    .lineTo(doc.page.width - MARGIN, y)
    .lineWidth(0.5)
    .strokeColor(GREY_RULE)
    .stroke();
  y += 8;
  totalLine("TOTAL TTC :", formatEuro(payload.totalTtc), y, true);

  if (societe && (societe.banque || societe.iban)) {
    let ry = y0;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN_DARK).text("RÈGLEMENT", MARGIN, ry, { width: reglementWidth });
    ry = doc.y + 4;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text("Par virement bancaire :", MARGIN, ry, {
      width: reglementWidth,
    });
    ry = doc.y + 2;
    doc.font("Helvetica").fontSize(9).fillColor(GREY_TEXT);
    if (societe.banque) {
      doc.text(`Banque : ${societe.banque}`, MARGIN, ry, { width: reglementWidth });
      ry = doc.y;
    }
    if (societe.iban) {
      doc.text(`IBAN : ${societe.iban}`, MARGIN, ry, { width: reglementWidth });
      ry = doc.y;
    }
  }

  doc.y = Math.max(y + 24, doc.y);
}

// Mention légale courte (RCS/NAF/TVA), toujours sur une seule ligne : peut être
// épinglée sans risque au bas de la dernière page.
function drawFooter(doc, societe) {
  if (!societe) return;
  const legal = [
    societe.rcs ? `RCS ${societe.rcs}` : null,
    societe.naf ? `NAF ${societe.naf}` : null,
    societe.tva != null ? `N° TVA : ${societe.tva}` : null,
  ].filter(Boolean);
  if (!legal.length) return;

  const footerY = doc.page.height - MARGIN - 16;
  // Si le contenu déjà présent empiète sur la zone du pied de page, on le
  // place en bas d'une nouvelle page plutôt que de risquer un chevauchement.
  if (doc.y > footerY - 10) {
    doc.addPage();
  }
  doc.font("Helvetica").fontSize(8).fillColor(GREY_LIGHT);
  doc.text(legal.join("   —   "), MARGIN, footerY, { width: doc.page.width - MARGIN * 2 - 90 });
}

// Conditions de vente : texte libre potentiellement long, donc affiché dans le
// flux normal du document (pas épinglé en bas, pour ne pas risquer un débordement).
function drawConditionsVente(doc, societe) {
  if (!societe || !societe.conditions_vente) return;
  doc.moveDown();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(GREEN_DARK).text("CONDITIONS DE VENTE");
  doc.font("Helvetica").fontSize(8).fillColor(GREY_LIGHT).text(societe.conditions_vente);
}

/// Génère le PDF d'un devis ou d'une facture (même structure de document).
/// payload = { label: "Devis"|"Facture", numero, date, notes, prestations, total,
///             chantier: { adresse, cp, ville }, client: { nom, prenom, nomSociete, adresse, cp, ville, telephone, portable, email } }
function generateDocumentPdf(payload, societe, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);

    doc.on("pageAdded", () => drawCornerDecorations(doc));
    drawCornerDecorations(doc);

    drawHeader(doc, payload, societe);
    drawParties(doc, payload, societe);
    drawTable(doc, payload.prestations);
    drawTotalsAndReglement(doc, payload, societe);

    // drawTotalsAndReglement positionne du texte à droite (bloc totaux) : on
    // ramène le curseur à la marge gauche avant de reprendre le flux normal.
    doc.x = MARGIN;

    if (payload.notes) {
      doc.moveDown();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN_DARK).text("NOTES");
      doc.font("Helvetica").fontSize(9).fillColor(GREY_TEXT).text(payload.notes);
    }

    drawConditionsVente(doc, societe);

    if (payload.signatureImagePath) {
      doc.moveDown(1.5);
      doc.font("Helvetica").fontSize(9).fillColor(GREY_TEXT).text("Signature du client :", { align: "right" });
      doc.moveDown(0.3);
      doc.image(payload.signatureImagePath, doc.page.width - MARGIN - 90, doc.y, { width: 90 });
    }

    drawFooter(doc, societe);

    doc.end();
  });
}

module.exports = { generateDocumentPdf };
