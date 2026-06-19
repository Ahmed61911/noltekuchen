import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoAsset from "@/assets/nolte-logo.png.asset.json";

export type PdfInvoice = {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  subtotal_ht: number;
  tax_amount: number;
  discount_amount: number;
  total_ttc: number;
  notes: string | null;
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
    discount_rate: number;
    line_total_ht: number;
    line_total_ttc: number;
  }>;
};

// Manual formatter — avoid Intl fr-FR because it inserts NARROW NO-BREAK SPACE (U+202F)
// as the thousands separator, which jsPDF's built-in Helvetica renders as an oversized
// gap (looks like letter-spacing between digits). We use a regular ASCII space instead.
const fmt = (n: number) => {
  const v = Number(n) || 0;
  const sign = v < 0 ? "-" : "";
  const [intPart, decPart] = Math.abs(v).toFixed(2).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${withThousands},${decPart} DH`;
};

let cachedLogo: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(logoAsset.url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogo = reader.result as string;
        resolve(cachedLogo);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Muted slate-gray palette inspired by the reference template
const SLATE: [number, number, number] = [96, 113, 130];
const SLATE_DARK: [number, number, number] = [70, 86, 102];
const TEXT_DARK: [number, number, number] = [55, 65, 75];
const TEXT_MUTED: [number, number, number] = [130, 140, 150];
const BORDER: [number, number, number] = [210, 215, 220];

export async function generateInvoicePdf(inv: PdfInvoice) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18; // outer margin

  // ===== HEADER =====
  const logo = await loadLogo();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", M, 18, 30, 13);
    } catch {
      /* ignore */
    }
  }
  // Brand block (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_DARK);
  doc.text("NOLTE", M, 38);
  doc.setTextColor(...SLATE);
  doc.text(" KÜCHEN", M + doc.getTextWidth("NOLTE"), 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("CUISINES ALLEMANDES D'EXCEPTION", M, 43);
  doc.text("Casablanca, Maroc", M, 49);
  doc.text("contact@nolte-kuchen.ma  •  +212 5 22 00 00 00", M, 54);

  // INVOICE title (right)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(38);
  doc.setTextColor(...SLATE_DARK);
  doc.text("INVOICE", pageW - M, 36, { align: "right" });

  // Meta strip (right)
  const stripY = 44;
  const stripW = 86;
  const stripX = pageW - M - stripW;
  doc.setFillColor(...SLATE);
  doc.rect(stripX, stripY, stripW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const half = stripW / 2;
  doc.text(`FACTURE N° ${inv.invoice_number}`, stripX + half / 2, stripY + 5.2, { align: "center" });
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(stripX + half, stripY + 2, stripX + half, stripY + 6);
  doc.text(
    `DATE ${new Date(inv.invoice_date).toLocaleDateString("fr-FR")}`,
    stripX + half + half / 2,
    stripY + 5.2,
    { align: "center" }
  );

  // ===== BILL TO =====
  let y = 70;
  doc.setFillColor(...SLATE);
  doc.rect(M, y, 22, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("Facturé à :", M + 11, y + 4, { align: "center" });

  y += 11;
  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  if (inv.customer) {
    doc.text(inv.customer.name, M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    let cy = y + 5;
    if (inv.customer.address) { doc.text(inv.customer.address, M, cy); cy += 4; }
    if (inv.customer.postal_code || inv.customer.city) {
      doc.text(`${inv.customer.postal_code ?? ""} ${inv.customer.city ?? ""}`.trim(), M, cy);
      cy += 4;
    }
    if (inv.customer.email) { doc.text(inv.customer.email, M, cy); cy += 4; }
    if (inv.customer.phone) { doc.text(inv.customer.phone, M, cy); }
  } else {
    doc.text("—", M, y);
  }

  // Échéance (right)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Échéance :", pageW - M, y - 4, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text(new Date(inv.due_date).toLocaleDateString("fr-FR"), pageW - M, y + 2, { align: "right" });

  // ===== ITEMS TABLE =====
  const tableY = 100;
  autoTable(doc, {
    startY: tableY,
    head: [["QTÉ", "DESCRIPTION", "PRIX", "TOTAL"]],
    body: inv.items.map((it) => [
      String(it.quantity),
      it.description,
      fmt(it.unit_price),
      fmt(it.line_total_ht),
    ]),
    headStyles: {
      fillColor: SLATE,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
      textColor: TEXT_DARK,
      lineColor: BORDER,
      lineWidth: 0.2,
      minCellHeight: 11,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 22 },
      1: { halign: "left" },
      2: { halign: "right", cellWidth: 32 },
      3: { halign: "right", cellWidth: 36 },
    },
    theme: "grid",
    margin: { left: M, right: M },
  });

  // ===== TOTALS =====
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const totalsLabelX = pageW - M - 68;
  const totalsValueX = pageW - M - 4;

  let ty = finalY + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  doc.text("Sous-total HT", totalsLabelX, ty);
  doc.text(fmt(inv.subtotal_ht), totalsValueX, ty, { align: "right" });

  ty += 6;
  doc.text("TVA", totalsLabelX, ty);
  doc.text(fmt(inv.tax_amount), totalsValueX, ty, { align: "right" });

  if (inv.discount_amount > 0) {
    ty += 6;
    doc.text("Remise", totalsLabelX, ty);
    doc.text("-" + fmt(inv.discount_amount), totalsValueX, ty, { align: "right" });
  }

  // ===== THANK YOU + TOTAL bar =====
  ty += 8;
  const barH = 12;
  // Left thank-you portion
  const thankW = (pageW - M * 2) * 0.55;
  doc.setFillColor(...SLATE);
  doc.rect(M, ty, thankW, barH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("MERCI POUR VOTRE CONFIANCE", M + 6, ty + barH / 2 + 1.2);

  // Right total portion
  const totalX = M + thankW;
  const totalW = pageW - M - totalX;
  doc.setFillColor(...SLATE_DARK);
  doc.rect(totalX, ty, totalW, barH, "F");
  doc.setFontSize(10);
  doc.text("TOTAL", totalX + 6, ty + barH / 2 + 1.2);
  doc.setFontSize(11);
  doc.text(fmt(inv.total_ttc), totalX + totalW - 4, ty + barH / 2 + 1.4, { align: "right" });

  // ===== TERMS + SIGNATURE =====
  let termsY = ty + barH + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  const terms = [
    "Paiement à réception de la facture, sauf accord préalable.",
    "Pénalités de retard de 1,5 % par mois en cas de non-paiement à l'échéance.",
    "RIB : 007 780 0001234567890123 45 — Attijariwafa Bank — SWIFT : BCMAMAMC",
  ];
  terms.forEach((t, i) => doc.text(t, M, termsY + i * 4));

  if (inv.notes) {
    const notesY = termsY + terms.length * 4 + 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text("Notes :", M, notesY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    const split = doc.splitTextToSize(inv.notes, pageW - M * 2 - 70);
    doc.text(split, M, notesY + 4);
  }

  // Signature line (right)
  const sigY = termsY + 14;
  doc.setDrawColor(...TEXT_MUTED);
  doc.setLineWidth(0.3);
  doc.line(pageW - M - 60, sigY, pageW - M, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Signature", pageW - M - 30, sigY + 4, { align: "center" });

  // ===== Decorative wave footer =====
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.4);
  const waveY = pageH - 18;
  const steps = 60;
  for (let i = 0; i < steps; i++) {
    const x1 = M + ((pageW - M * 2) * i) / steps;
    const x2 = M + ((pageW - M * 2) * (i + 1)) / steps;
    const y1 = waveY + Math.sin((i / steps) * Math.PI * 4) * 2;
    const y2 = waveY + Math.sin(((i + 1) / steps) * Math.PI * 4) * 2;
    doc.line(x1, y1, x2, y2);
  }
  doc.setDrawColor(...BORDER);
  for (let i = 0; i < steps; i++) {
    const x1 = M + ((pageW - M * 2) * i) / steps;
    const x2 = M + ((pageW - M * 2) * (i + 1)) / steps;
    const y1 = waveY + 3 + Math.sin((i / steps) * Math.PI * 4 + 0.6) * 2;
    const y2 = waveY + 3 + Math.sin(((i + 1) / steps) * Math.PI * 4 + 0.6) * 2;
    doc.line(x1, y1, x2, y2);
  }

  doc.save(`${inv.invoice_number}.pdf`);
}
