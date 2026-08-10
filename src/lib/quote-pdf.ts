import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { pdfMoney, pdfNumber, pdfText } from "@/lib/pdf-safe";
import { drawNadoCuisineHeader, NADO_LEGAL_LINES } from "@/lib/nado-logo-pdf";

export type PdfQuote = {
  quote_number: string;
  quote_date: string;
  expiry_date: string;
  status: string;
  subtotal_ht: number;
  tax: number;
  discount: number;
  total_ttc: number;
  notes: string | null;
  custom_price?: { label: string; amount: number; addToTotal: boolean } | null;
  bouhlalla_price?: number | null;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
  } | null;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    discount: number;
    total: number;
    code?: string | null;
  }>;
};

type RGB = [number, number, number];

/**
 * Palette reprise des tokens de `src/styles.css`, convertie d'OKLCH en sRGB.
 * L'identité de la marque est l'orange (`--primary`) ; il n'apparaît ici qu'en
 * filets et en réglettes, un document comptable devant rester lisible une fois
 * imprimé en noir et blanc.
 */
const BRAND: RGB = [254, 120, 1]; // --primary        oklch(0.72 0.19 50)
const INK: RGB = [18, 27, 41]; // --foreground        oklch(0.22 0.03 260)
const MUTED: RGB = [98, 106, 117]; // --muted-foreground oklch(0.52 0.02 258)
const SURFACE: RGB = [243, 241, 238]; // --muted       oklch(0.96 0.005 80)
const TINT: RGB = [255, 235, 217]; // --accent         oklch(0.96 0.04 55)
const LINE_SOFT: RGB = [230, 228, 225]; // --border    oklch(0.92 0.005 80)
const LINE: RGB = [206, 203, 199]; // --border assombri, pour survivre à l'impression
const RED: RGB = [176, 32, 45]; // --destructive assombri (le token pur vire au rose à l'écran)
const WHITE: RGB = [255, 255, 255];

const STATUS_CHIP: Record<string, { label: string; fg: RGB; bg: RGB }> = {
  draft: { label: "Brouillon", fg: MUTED, bg: SURFACE },
  pending: { label: "En attente", fg: [180, 83, 9], bg: [253, 240, 218] },
  paid: { label: "Payée", fg: [4, 120, 87], bg: [219, 244, 236] },
  cancelled: { label: "Annulée", fg: [190, 18, 60], bg: [253, 226, 231] },
};

const PAYMENT_TERMS = [
  "Validité de l'offre : 30 jours à compter de la date d'émission.",
  "La signature de ce devis vaut bon de commande et acceptation des conditions générales de vente.",
];

const LEGAL_LINES = NADO_LEGAL_LINES;

/** Montant : deux décimales, séparateur de milliers en espace ordinaire. */
const money = (n: unknown) => pdfMoney(Number(n) || 0, "DH", 2);

/** Quantité : entière quand elle l'est, deux décimales sinon. */
const quantity = (n: unknown) => {
  const v = Number(n) || 0;
  return pdfNumber(v, Number.isInteger(v) ? 0 : 2);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
};

/**
 * `pdfText` retire les caractères hors WinAnsi — sauts de ligne compris. Sur un
 * texte multiligne il faut donc nettoyer ligne par ligne, sinon les mots de
 * deux lignes consécutives se retrouvent collés.
 */
const safeLines = (value: unknown): string[] =>
  String(value ?? "")
    .split(/\r?\n/)
    .map((line) => pdfText(line));

const safeMultiline = (value: unknown) => safeLines(value).join("\n");

/** Largeur d'un texte dont la chasse est élargie de `tracking`. */
const trackedWidth = (doc: jsPDF, text: string, tracking: number) =>
  doc.getTextWidth(text) + tracking * Math.max(0, text.length - 1);

/** Texte à chasse élargie — réservé aux petites capitales d'intitulé. */
const tracked = (doc: jsPDF, text: string, x: number, y: number, tracking: number) => {
  let cursor = x;
  for (const letter of text) {
    doc.text(letter, cursor, y);
    cursor += doc.getTextWidth(letter) + tracking;
  }
};

/** Tronque au besoin : mieux vaut un libellé écourté qu'un chevauchement. */
const ellipsize = (doc: jsPDF, text: string, maxWidth: number) => {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && doc.getTextWidth(`${out}...`) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
};

/** Réduit la taille de police jusqu'à ce que le texte tienne. Modifie `doc`. */
const fitFontSize = (doc: jsPDF, text: string, maxWidth: number, from: number, min: number) => {
  let size = from;
  while (size > min) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxWidth) break;
    size -= 0.5;
  }
  doc.setFontSize(size);
};

export function generateQuotePdf(inv: PdfQuote) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const M = 16;
  const contentW = pageW - M * 2;
  /** Bande réservée au pied de page légal, sur toutes les pages. */
  const FOOTER_RESERVE = 25;
  /** Ordonnée de reprise du contenu sur les pages 2 et suivantes. */
  const RUNNING_TOP = 33;
  const bottomLimit = pageH - FOOTER_RESERVE;

  // ---------------------------------------------------------------- totaux
  // Aucun recalcul : on reprend telles quelles les valeurs du document, comme
  // le faisait déjà cet export. `Number()` ne sert qu'à éviter une
  // concaténation si PostgREST renvoie un `numeric` sous forme de chaîne.
  const cp = inv.custom_price;
  const cpValid = !!cp && cp.label.trim() !== "" && Number.isFinite(Number(cp.amount));
  const finalTotal = Number(inv.total_ttc) + (cpValid && cp?.addToTotal ? Number(cp.amount) : 0);
  const bouhlalla = inv.bouhlalla_price;
  const hasBouhlalla = bouhlalla != null && Number.isFinite(Number(bouhlalla));

  // ------------------------------------------------- éléments répétés
  const drawRunningHeader = () => {
    drawNadoCuisineHeader(doc, M, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(pdfText(`Devis ${inv.quote_number} — suite`), pageW - M, 20, { align: "right" });
    doc.setDrawColor(...LINE_SOFT);
    doc.setLineWidth(0.3);
    doc.line(M, 27.5, pageW - M, 27.5);
  };

  const drawFooter = (pageNo: number, pageCount: number) => {
    const y = pageH - 21;
    doc.setDrawColor(...LINE_SOFT);
    doc.setLineWidth(0.3);
    doc.line(M, y, pageW - M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    LEGAL_LINES.forEach((line, i) => {
      doc.text(pdfText(line), pageW / 2, y + 4.5 + i * 3.5, { align: "center" });
    });
    doc.text(pdfText(`Page ${pageNo} / ${pageCount}`), pageW - M, y + 12, { align: "right" });
  };

  /**
   * Renvoie une ordonnée où `needed` millimètres tiennent sans mordre sur le
   * pied de page, en ouvrant une page si nécessaire. C'est ce qui empêche le
   * bloc des totaux d'être coupé en deux.
   */
  const ensureSpace = (y: number, needed: number) => {
    if (y + needed <= bottomLimit) return y;
    doc.addPage();
    drawRunningHeader();
    return RUNNING_TOP;
  };

  // ==================================================== en-tête (page 1)
  drawNadoCuisineHeader(doc, M, 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...INK);
  doc.text("DEVIS", pageW - M, 19, { align: "right" });

  const metaLabelX = pageW - M - 62;
  const metaValueX = pageW - M;
  const meta: Array<[string, string]> = [
    ["N° de devis", pdfText(inv.quote_number)],
    ["Date d'émission", formatDate(inv.quote_date)],
    ["Date de validité", formatDate(inv.expiry_date)],
  ];
  meta.forEach(([label, value], i) => {
    const y = 26.5 + i * 4.8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(label), metaLabelX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(value, metaValueX, y, { align: "right" });
  });

  const chip = STATUS_CHIP[inv.status] ?? { label: inv.status, fg: MUTED, bg: SURFACE };
  const chipLabel = pdfText(chip.label).toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const chipW = trackedWidth(doc, chipLabel, 0.3) + 9;
  const chipH = 6.4;
  const chipX = pageW - M - chipW;
  const chipY = 39;
  doc.setFillColor(...chip.bg);
  doc.roundedRect(chipX, chipY, chipW, chipH, chipH / 2, chipH / 2, "F");
  doc.setTextColor(...chip.fg);
  tracked(doc, chipLabel, chipX + 4.5, chipY + 4.3, 0.3);

  // Filet de séparation + réglette orange.
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.line(M, 50, pageW - M, 50);
  doc.setFillColor(...BRAND);
  doc.rect(M, 49.3, 26, 1.4, "F");

  // ======================================== client / montant à payer
  const blockY = 55;
  const clientW = 100;
  const amountW = 72;
  const amountX = pageW - M - amountW;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const customer = inv.customer;
  const clientLines: string[] = [];
  if (customer) {
    if (customer.address) {
      const wrapped = doc.splitTextToSize(pdfText(customer.address), clientW - 12) as string[];
      clientLines.push(...wrapped);
    }
    const cityLine = `${customer.postal_code ?? ""} ${customer.city ?? ""}`.trim();
    if (cityLine) clientLines.push(pdfText(cityLine));
    if (customer.phone) clientLines.push(pdfText(`Tél : ${customer.phone}`));
    if (customer.email) clientLines.push(pdfText(customer.email));
  }
  const blockH = Math.max(31, 21 + clientLines.length * 4.2);

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.rect(M, blockY, clientW, blockH, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  tracked(doc, pdfText("ADRESSÉ À"), M + 6, blockY + 7, 0.35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(ellipsize(doc, pdfText(customer?.name ?? "—"), clientW - 12), M + 6, blockY + 14.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  clientLines.forEach((line, i) => {
    doc.text(line, M + 6, blockY + 20 + i * 4.2);
  });

  doc.setFillColor(...SURFACE);
  doc.rect(amountX, blockY, amountW, blockH, "F");
  doc.setFillColor(...BRAND);
  doc.rect(amountX, blockY, 1.4, blockH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const amountLabel = "MONTANT DU DEVIS";
  tracked(doc, pdfText(amountLabel), amountX + 6, blockY + 7, 0.35);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  const totalText = money(finalTotal);
  fitFontSize(doc, totalText, amountW - 12, 15, 9);
  doc.text(totalText, amountX + amountW - 6, blockY + 17.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(pdfText(`Dont TVA : ${money(inv.tax)}`), amountX + 6, blockY + 24);

  // ============================================== tableau des lignes
  // Les colonnes optionnelles disparaissent quand elles n'apportent rien : les
  // ventes comptoir n'ont pas de référence article, et la plupart des devis
  // n'ont aucune remise ligne à ligne.
  const hasCode = inv.items.some((it) => String(it.code ?? "").trim() !== "");
  const hasDiscount = inv.items.some((it) => Number(it.discount) > 0);

  type Col = { key: string; title: string; width?: number; align: "left" | "right" };
  const cols: Col[] = [{ key: "desc", title: "Description", align: "left" }];
  if (hasCode) cols.push({ key: "code", title: "Référence", width: 26, align: "left" });
  cols.push({ key: "qty", title: "Qté", width: 14, align: "right" });
  cols.push({ key: "pu", title: "P.U. HT", width: 30, align: "right" });
  if (hasDiscount) cols.push({ key: "rem", title: "Remise", width: 18, align: "right" });
  cols.push({ key: "tot", title: "Total HT", width: 32, align: "right" });

  const cell = (col: Col, it: PdfQuote["items"][number]) => {
    switch (col.key) {
      case "desc":
        return safeMultiline(it.description);
      case "code":
        return pdfText(it.code ?? "");
      case "qty":
        return quantity(it.quantity);
      case "pu":
        return money(it.unit_price);
      case "rem": {
        const rate = Number(it.discount) || 0;
        return rate > 0 ? `${pdfNumber(rate, Number.isInteger(rate) ? 0 : 2)} %` : "";
      }
      default:
        return money(it.total);
    }
  };

  const body = inv.items.length
    ? inv.items.map((it) => cols.map((col) => cell(col, it)))
    : [cols.map((_col, i) => (i === 0 ? pdfText("Aucune ligne") : ""))];

  const columnStyles: Record<string, { halign: "left" | "right"; cellWidth?: number }> = {};
  cols.forEach((col, i) => {
    columnStyles[i] = { halign: col.align };
    if (col.width) columnStyles[i].cellWidth = col.width;
  });

  autoTable(doc, {
    startY: blockY + blockH + 10,
    head: [cols.map((col) => pdfText(col.title))],
    body,
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: INK,
      lineWidth: 0,
      overflow: "linebreak",
      valign: "middle",
      cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
    },
    headStyles: {
      fillColor: INK,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 3.4, bottom: 3.4, left: 3, right: 3 },
    },
    bodyStyles: { minCellHeight: 8 },
    alternateRowStyles: { fillColor: SURFACE },
    columnStyles,
    margin: { top: RUNNING_TOP, left: M, right: M, bottom: FOOTER_RESERVE },
    // L'en-tête se répète sur chaque page, et les pages 2+ reçoivent un
    // bandeau d'identification avant que le tableau ne reprenne.
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawRunningHeader();
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.line(M, finalY + 0.5, pageW - M, finalY + 0.5);

  // ========================================================== totaux
  const totalRows: Array<{ label: string; value: string; muted?: boolean }> = [
    { label: "Sous-total HT", value: money(inv.subtotal_ht) },
    { label: "TVA", value: money(inv.tax) },
  ];
  if (Number(inv.discount) > 0) {
    totalRows.push({ label: "Remise", value: `-${money(inv.discount)}` });
  }
  if (cpValid && cp) {
    totalRows.push({
      label: cp.label + (cp.addToTotal ? "" : " (info)"),
      value: money(cp.amount),
      muted: !cp.addToTotal,
    });
  }

  const bandH = 12;
  const totalsH = totalRows.length * 5.6 + 4.5 + bandH + (hasBouhlalla ? 17 : 0);
  let y = ensureSpace(finalY + 10, totalsH);

  const totalsX = pageW - M - 88;
  const valueX = pageW - M;
  for (const row of totalRows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...(row.muted ? MUTED : INK));
    doc.text(ellipsize(doc, pdfText(row.label), 46), totalsX, y);
    doc.text(row.value, valueX, y, { align: "right" });
    y += 5.6;
  }

  y += 1.5;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(totalsX - 4, y, valueX, y);
  y += 3;

  doc.setFillColor(...TINT);
  doc.rect(totalsX - 4, y, pageW - M - (totalsX - 4), bandH, "F");
  doc.setFillColor(...BRAND);
  doc.rect(totalsX - 4, y, 1.4, bandH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(pdfText("TOTAL TTC"), totalsX, y + 7.6);
  doc.setFont("helvetica", "bold");
  fitFontSize(doc, totalText, 44, 13, 9);
  doc.text(totalText, valueX - 3, y + 7.8, { align: "right" });
  y += bandH;

  if (hasBouhlalla) {
    y += 5;
    const boxH = 11;
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.4);
    doc.rect(totalsX - 4, y, pageW - M - (totalsX - 4), boxH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...RED);
    doc.text(pdfText("Prix de Mr Bouhlalla"), totalsX, y + 7);
    doc.text(money(bouhlalla), valueX - 3, y + 7, { align: "right" });
    y += boxH;
  }

  // =========================================================== notes
  const noteSource = inv.notes == null ? "" : String(inv.notes);
  if (noteSource.trim() !== "") {
    y = ensureSpace(y + 10, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    tracked(doc, pdfText("NOTES"), M, y, 0.35);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const noteLines = safeLines(noteSource).flatMap(
      (line) => doc.splitTextToSize(line, contentW) as string[],
    );
    for (const line of noteLines) {
      y = ensureSpace(y, 4.2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(line, M, y);
      y += 4.2;
    }
  }

  // ======================================== conditions de paiement
  // Épinglées en bas de la dernière page si la place le permet, sinon
  // reportées sur une page supplémentaire plutôt que chevaucher les totaux.
  const termsH = 5 + PAYMENT_TERMS.length * 3.9;
  let termsY = bottomLimit - termsH;
  if (termsY < y + 10) {
    doc.addPage();
    drawRunningHeader();
    termsY = RUNNING_TOP + 6;
  }
  doc.setDrawColor(...LINE_SOFT);
  doc.setLineWidth(0.3);
  doc.line(M, termsY - 5, pageW - M, termsY - 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  tracked(doc, pdfText("CONDITIONS ET VALIDITÉ"), M, termsY, 0.35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  PAYMENT_TERMS.forEach((term, i) => {
    doc.text(pdfText(term), M, termsY + 5 + i * 3.9);
  });

  // ================================================= pieds de page
  // Une fois seulement que le nombre total de pages est connu.
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawFooter(page, pageCount);
  }

  const fileName = String(inv.quote_number ?? "devis").replace(/[\\/:*?"<>|]+/g, "-");
  doc.save(`${fileName}.pdf`);
}
