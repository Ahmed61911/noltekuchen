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
  customer: { name: string; email: string | null; phone: string | null; address: string | null; city: string | null; postal_code: string | null } | null;
  items: Array<{ description: string; quantity: number; unit_price: number; tax_rate: number; discount_rate: number; line_total_ht: number; line_total_ttc: number }>;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", pending: "En attente", paid: "Payée", cancelled: "Annulée",
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

export async function generateInvoicePdf(inv: PdfInvoice) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Brand band
  doc.setFillColor(255, 237, 0); // Nolte yellow
  doc.rect(0, 0, pageW, 4, "F");

  // Logo
  const logo = await loadLogo();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 14, 12, 42, 19);
    } catch {
      /* ignore */
    }
  } else {
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("NOLTE KÜCHEN", 14, 24);
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110);
  doc.text("ERP Interne — Nolte Küchen", 14, 36);

  // Invoice title block
  doc.setTextColor(20);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURE", pageW - 14, 20, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(inv.invoice_number, pageW - 14, 27, { align: "right" });
  doc.setTextColor(110);
  doc.text(`Statut : ${STATUS_LABELS[inv.status] ?? inv.status}`, pageW - 14, 33, { align: "right" });
  doc.setTextColor(20);

  // Separator
  doc.setDrawColor(230);
  doc.line(14, 44, pageW - 14, 44);

  // Customer + dates
  let y = 54;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Facturé à", 14, y);
  doc.setFont("helvetica", "normal");
  if (inv.customer) {
    y += 6; doc.text(inv.customer.name, 14, y);
    if (inv.customer.address) { y += 5; doc.text(inv.customer.address, 14, y); }
    if (inv.customer.postal_code || inv.customer.city) {
      y += 5;
      doc.text(`${inv.customer.postal_code ?? ""} ${inv.customer.city ?? ""}`.trim(), 14, y);
    }
    if (inv.customer.email) { y += 5; doc.text(inv.customer.email, 14, y); }
    if (inv.customer.phone) { y += 5; doc.text(inv.customer.phone, 14, y); }
  } else {
    y += 6; doc.text("—", 14, y);
  }

  doc.setFont("helvetica", "bold");
  doc.text("Date facture :", pageW - 70, 54);
  doc.setFont("helvetica", "normal");
  doc.text(inv.invoice_date, pageW - 14, 54, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text("Échéance :", pageW - 70, 60);
  doc.setFont("helvetica", "normal");
  doc.text(inv.due_date, pageW - 14, 60, { align: "right" });

  // Items table
  autoTable(doc, {
    startY: Math.max(y + 10, 84),
    head: [["Description", "Qté", "PU", "TVA %", "Rem %", "Total HT"]],
    body: inv.items.map((it) => [
      it.description,
      String(it.quantity),
      fmt(it.unit_price),
      `${it.tax_rate}%`,
      `${it.discount_rate}%`,
      fmt(it.line_total_ht),
    ]),
    headStyles: { fillColor: [26, 23, 27], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });

  // Totals
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  const labelX = pageW - 70;
  const valX = pageW - 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Sous-total HT :", labelX, finalY);
  doc.text(fmt(inv.subtotal_ht), valX, finalY, { align: "right" });
  doc.text("TVA :", labelX, finalY + 6);
  doc.text(fmt(inv.tax_amount), valX, finalY + 6, { align: "right" });
  let totalsY = finalY + 12;
  if (inv.discount_amount > 0) {
    doc.text("Remise :", labelX, totalsY);
    doc.text("-" + fmt(inv.discount_amount), valX, totalsY, { align: "right" });
    totalsY += 6;
  }
  doc.setDrawColor(200);
  doc.line(labelX, totalsY + 2, valX, totalsY + 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total TTC :", labelX, totalsY + 10);
  doc.text(fmt(inv.total_ttc), valX, totalsY + 10, { align: "right" });

  if (inv.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text("Notes : " + inv.notes, 14, totalsY + 24);
    doc.setTextColor(20);
  }

  // Footer
  doc.setFillColor(255, 237, 0);
  doc.rect(0, pageH - 14, pageW, 4, "F");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Merci pour votre confiance — Nolte Küchen", pageW / 2, pageH - 6, { align: "center" });

  doc.save(`${inv.invoice_number}.pdf`);
}
