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
    code?: string | null;
  }>;
};

// Manual formatter to avoid NARROW NO-BREAK SPACE issues with Helvetica.
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

// Palette — Nolte Küchen: sober navy header + red accent for totals
const HEADER_BLUE: [number, number, number] = [42, 63, 95];
const ACCENT_RED: [number, number, number] = [200, 30, 30];
const TEXT_DARK: [number, number, number] = [35, 40, 50];
const TEXT_MUTED: [number, number, number] = [110, 120, 130];
const BORDER: [number, number, number] = [180, 188, 198];
const BORDER_STRONG: [number, number, number] = [90, 100, 115];

export async function generateInvoicePdf(inv: PdfInvoice) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18;

  // ===== HEADER — company identity centered =====
  const logo = await loadLogo();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", M, 14, 26, 12);
    } catch {
      /* ignore */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...TEXT_DARK);
  doc.text("NOLTE KÜCHEN", pageW / 2, 22, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Cuisines allemandes d'exception — Vente, installation et équipement", pageW / 2, 28, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.text("Importation et distribution officielle", pageW / 2, 33, { align: "center" });

  // Divider
  doc.setDrawColor(...BORDER_STRONG);
  doc.setLineWidth(0.4);
  doc.line(M, 38, pageW - M, 38);

  // ===== FACTURE title band =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...HEADER_BLUE);
  doc.text("FACTURE", pageW / 2, 48, { align: "center" });

  // Meta row: N° facture (left) — Date (right)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text(`N° : ${inv.invoice_number}`, M, 56);
  doc.text(
    `Date : ${new Date(inv.invoice_date).toLocaleDateString("fr-FR")}`,
    pageW - M,
    56,
    { align: "right" }
  );

  // ===== CLIENT block =====
  let cy = 66;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_DARK);
  doc.text("CLIENT :", M, cy);
  doc.setFont("helvetica", "normal");
  if (inv.customer) {
    doc.text(inv.customer.name, M + 22, cy);
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    let ly = cy + 5;
    if (inv.customer.address) { doc.text(inv.customer.address, M + 22, ly); ly += 4; }
    if (inv.customer.postal_code || inv.customer.city) {
      doc.text(`${inv.customer.postal_code ?? ""} ${inv.customer.city ?? ""}`.trim(), M + 22, ly);
      ly += 4;
    }
    if (inv.customer.phone) doc.text(`Tél : ${inv.customer.phone}`, M + 22, ly);
  } else {
    doc.text("—", M + 22, cy);
  }

  // Échéance right side
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Échéance :", pageW - M - 40, cy);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(new Date(inv.due_date).toLocaleDateString("fr-FR"), pageW - M, cy, { align: "right" });

  // ===== ITEMS TABLE =====
  autoTable(doc, {
    startY: 90,
    head: [["Description", "Code", "Prix", "Total"]],
    body: inv.items.map((it) => [
      it.description,
      it.code ?? "—",
      fmt(it.unit_price),
      fmt(it.line_total_ht),
    ]),
    headStyles: {
      fillColor: HEADER_BLUE,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9.5,
      halign: "left",
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      lineColor: BORDER_STRONG,
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 9.5,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
      textColor: TEXT_DARK,
      lineColor: BORDER,
      lineWidth: 0.2,
      minCellHeight: 11,
    },
    columnStyles: {
      0: { halign: "left", overflow: "linebreak" },
      1: { halign: "center", cellWidth: 30 },
      2: { halign: "right", cellWidth: 36 },
      3: { halign: "right", cellWidth: 40, fontStyle: "bold" },
    },
    theme: "grid",
    margin: { left: M, right: M },
  });

  // ===== TOTALS =====
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const labelX = pageW - M - 76;
  const valueX = pageW - M - 4;

  let ty = finalY + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);

  doc.text("Sous-total HT", labelX, ty);
  doc.text(fmt(inv.subtotal_ht), valueX, ty, { align: "right" });

  ty += 6;
  doc.text("TVA", labelX, ty);
  doc.text(fmt(inv.tax_amount), valueX, ty, { align: "right" });

  if (inv.discount_amount > 0) {
    ty += 6;
    doc.text("Remise", labelX, ty);
    doc.text("-" + fmt(inv.discount_amount), valueX, ty, { align: "right" });
  }

  // TOTAL band — full width, blue header style like reference
  ty += 8;
  const barH = 11;
  doc.setFillColor(...HEADER_BLUE);
  doc.rect(labelX - 6, ty, pageW - M - (labelX - 6), barH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL TTC", labelX, ty + 7.2);
  doc.setFontSize(12);
  doc.text(fmt(inv.total_ttc), valueX, ty + 7.4, { align: "right" });

  // "PRIX DE Mr ..." line — red accent like reference
  if (inv.customer?.name) {
    ty += barH + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT_RED);
    doc.text(`PRIX DE ${inv.customer.name.toUpperCase()}`, M, ty);
    doc.text(fmt(inv.total_ttc), pageW - M, ty, { align: "right" });
    doc.setDrawColor(...ACCENT_RED);
    doc.setLineWidth(0.5);
    doc.line(pageW - M - 45, ty + 1.5, pageW - M, ty + 1.5);
  }

  // ===== NOTES =====
  if (inv.notes) {
    const ny = ty + 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_DARK);
    doc.text("Notes :", M, ny);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    const split = doc.splitTextToSize(inv.notes, pageW - M * 2);
    doc.text(split, M, ny + 5);
  }

  // ===== CONDITIONS DE PAIEMENT =====
  const condY = pageH - 48;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(M, condY - 4, pageW - M, condY - 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...HEADER_BLUE);
  doc.text("CONDITIONS DE PAIEMENT", M, condY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  const terms = [
    "Paiement à réception de facture, sauf accord préalable écrit.",
    "Pénalités de retard : 1,5 % par mois sur le montant TTC.",
    "RIB : 007 780 0001234567890123 45 — Attijariwafa Bank — SWIFT : BCMAMAMC",
  ];
  terms.forEach((t, i) => doc.text(t, M, condY + 4 + i * 3.8));

  // ===== FOOTER — legal identity =====
  doc.setDrawColor(...BORDER_STRONG);
  doc.setLineWidth(0.4);
  doc.line(M, pageH - 22, pageW - M, pageH - 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    "NOLTE KÜCHEN — Société à responsabilité limitée au capital de 500.000 DHS",
    pageW / 2,
    pageH - 17,
    { align: "center" }
  );
  doc.text(
    "Siège social : Boulevard Zerktouni — Casablanca, Maroc",
    pageW / 2,
    pageH - 13,
    { align: "center" }
  );
  doc.text(
    "IF : 40422840   —   RC : 106030   —   ICE : 002597960000073   —   contact@nolte-kuchen.ma   —   +212 5 22 00 00 00",
    pageW / 2,
    pageH - 9,
    { align: "center" }
  );

  doc.save(`${inv.invoice_number}.pdf`);
}
