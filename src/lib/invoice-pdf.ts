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

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  paid: "Payée",
  cancelled: "Annulée",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(Number(n) || 0) + " DH";

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

// Brand color (blue accent like template)
const ACCENT: [number, number, number] = [37, 99, 175]; // deep blue
const ACCENT_DARK: [number, number, number] = [20, 60, 120];
const TEXT_DARK: [number, number, number] = [30, 30, 30];
const TEXT_MUTED: [number, number, number] = [110, 110, 110];

export async function generateInvoicePdf(inv: PdfInvoice) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Top accent bar
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageW, 6, "F");

  // ===== HEADER =====
  const logo = await loadLogo();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 14, 14, 38, 17);
    } catch {
      /* ignore */
    }
  }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text("NOLTE", 14, 38);
  doc.setTextColor(...TEXT_DARK);
  doc.text(" KÜCHEN", 14 + doc.getTextWidth("NOLTE"), 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("CUISINES ALLEMANDES D'EXCEPTION", 14, 43);

  // Company contact (right)
  const rightX = pageW - 14;
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  doc.text("Casablanca, Maroc", rightX, 18, { align: "right" });
  doc.setTextColor(...TEXT_MUTED);
  doc.text("contact@nolte-kuchen.ma", rightX, 24, { align: "right" });
  doc.text("+212 5 22 00 00 00", rightX, 30, { align: "right" });
  doc.text("www.nolte-kuchen.ma", rightX, 36, { align: "right" });

  // ===== INVOICE TITLE =====
  let y = 58;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.2);
  doc.line(14, y - 6, 14, y + 2);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text("FACTURE", 18, y);

  // Invoice meta (left)
  y += 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text("N° FACTURE", 14, y);
  doc.text(":", 44, y);
  doc.setFont("helvetica", "normal");
  doc.text(inv.invoice_number, 48, y);

  doc.setFont("helvetica", "bold");
  doc.text("DATE", 14, y + 5);
  doc.text(":", 44, y + 5);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(inv.invoice_date).toLocaleDateString("fr-FR"), 48, y + 5);

  doc.setFont("helvetica", "bold");
  doc.text("ÉCHÉANCE", 14, y + 10);
  doc.text(":", 44, y + 10);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(inv.due_date).toLocaleDateString("fr-FR"), 48, y + 10);

  // Client block (right)
  const clientX = pageW / 2 + 6;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1);
  doc.line(clientX - 4, y - 4, clientX - 4, y + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT);
  doc.text("FACTURÉ À :", clientX, y);
  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(9);
  let cy = y + 6;
  if (inv.customer) {
    doc.setFont("helvetica", "bold");
    doc.text(inv.customer.name, clientX, cy);
    doc.setFont("helvetica", "normal");
    if (inv.customer.address) {
      cy += 5;
      doc.text(inv.customer.address, clientX, cy);
    }
    if (inv.customer.postal_code || inv.customer.city) {
      cy += 5;
      doc.text(`${inv.customer.postal_code ?? ""} ${inv.customer.city ?? ""}`.trim(), clientX, cy);
    }
    if (inv.customer.email) {
      cy += 5;
      doc.setTextColor(...TEXT_MUTED);
      doc.text(inv.customer.email, clientX, cy);
    }
    if (inv.customer.phone) {
      cy += 5;
      doc.text(inv.customer.phone, clientX, cy);
    }
  } else {
    doc.text("—", clientX, cy);
  }

  // ===== DUE TOTAL BANNER =====
  y += 22;
  doc.setFillColor(...ACCENT);
  doc.rect(14, y, 70, 14, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL À PAYER", 18, y + 5);
  doc.setFontSize(14);
  doc.text(fmt(inv.total_ttc), 18, y + 11);

  // Status badge
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const statusLabel = STATUS_LABELS[inv.status] ?? inv.status;
  doc.setFillColor(...ACCENT_DARK);
  const sw = doc.getTextWidth(statusLabel) + 8;
  doc.roundedRect(pageW - 14 - sw, y + 3, sw, 8, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, pageW - 14 - sw / 2, y + 8.5, { align: "center" });

  // ===== ITEMS TABLE =====
  y += 22;
  autoTable(doc, {
    startY: y,
    head: [["Description", "Prix", "Qté", "TVA", "Total HT"]],
    body: inv.items.map((it) => [
      it.description,
      fmt(it.unit_price),
      String(it.quantity),
      `${it.tax_rate}%`,
      fmt(it.line_total_ht),
    ]),
    headStyles: {
      fillColor: ACCENT,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: TEXT_DARK,
    },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "right", fontStyle: "bold" },
    },
    theme: "plain",
    margin: { left: 14, right: 14 },
  });

  // ===== TOTALS =====
  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const totalsX = pageW - 84;
  const totalsW = 70;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DARK);

  const drawTotalRow = (label: string, value: string, atY: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, totalsX, atY);
    doc.text(value, totalsX + totalsW, atY, { align: "right" });
  };

  let ty = finalY;
  drawTotalRow("Sous-total HT", fmt(inv.subtotal_ht), ty);
  ty += 6;
  drawTotalRow(`TVA`, fmt(inv.tax_amount), ty);
  if (inv.discount_amount > 0) {
    ty += 6;
    drawTotalRow("Remise", "-" + fmt(inv.discount_amount), ty);
  }
  ty += 4;

  // Grand total bar
  ty += 4;
  doc.setFillColor(...ACCENT);
  doc.rect(totalsX - 4, ty - 5, totalsW + 4, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL TTC", totalsX, ty + 1);
  doc.text(fmt(inv.total_ttc), totalsX + totalsW, ty + 1, { align: "right" });

  // ===== PAYMENT METHOD + TERMS =====
  const leftY = finalY;
  doc.setTextColor(...ACCENT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1);
  doc.line(14, leftY - 5, 14, leftY + 3);
  doc.text("Mode de paiement :", 18, leftY);

  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Banque", 18, leftY + 7);
  doc.setFont("helvetica", "normal");
  doc.text("Attijariwafa Bank", 50, leftY + 7);
  doc.setFont("helvetica", "bold");
  doc.text("RIB", 18, leftY + 12);
  doc.setFont("helvetica", "normal");
  doc.text("007 780 0001234567890123 45", 50, leftY + 12);
  doc.setFont("helvetica", "bold");
  doc.text("Titulaire", 18, leftY + 17);
  doc.setFont("helvetica", "normal");
  doc.text("Nolte Küchen SARL", 50, leftY + 17);
  doc.setFont("helvetica", "bold");
  doc.text("SWIFT", 18, leftY + 22);
  doc.setFont("helvetica", "normal");
  doc.text("BCMAMAMC", 50, leftY + 22);

  // ===== TERMS & NOTES =====
  const termsY = Math.max(ty + 18, leftY + 36);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1);
  doc.line(14, termsY - 5, 14, termsY + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT);
  doc.text("Conditions générales :", 18, termsY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_DARK);
  const terms = [
    "1. Paiement à réception de la facture sauf accord préalable.",
    "2. Pénalités de retard de 1,5% par mois en cas de non-paiement à l'échéance.",
    "3. TVA non récupérable pour les particuliers. Garantie selon conditions du constructeur.",
  ];
  terms.forEach((t, i) => doc.text(t, 18, termsY + 7 + i * 5));

  if (inv.notes) {
    const notesY = termsY + 7 + terms.length * 5 + 4;
    doc.setFont("helvetica", "bold");
    doc.text("Notes :", 18, notesY);
    doc.setFont("helvetica", "normal");
    const split = doc.splitTextToSize(inv.notes, pageW - 36);
    doc.text(split, 18, notesY + 5);
  }

  // Signature (right)
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(pageW - 70, termsY + 18, pageW - 14, termsY + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  doc.text("Direction commerciale", pageW - 42, termsY + 23, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Nolte Küchen", pageW - 42, termsY + 28, { align: "center" });

  // ===== FOOTER =====
  doc.setFillColor(...ACCENT);
  doc.rect(0, pageH - 8, pageW, 8, "F");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "Merci pour votre confiance — Nolte Küchen",
    pageW / 2,
    pageH - 3,
    { align: "center" }
  );

  doc.save(`${inv.invoice_number}.pdf`);
}
