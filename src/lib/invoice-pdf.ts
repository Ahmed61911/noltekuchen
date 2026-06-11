import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n) + " DH";

export function generateInvoicePdf(inv: PdfInvoice) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22); doc.setFont("helvetica", "bold");
  doc.text("NOLTE KÜCHEN", 14, 20);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("ERP Interne", 14, 26);

  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("FACTURE", pageW - 14, 20, { align: "right" });
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(inv.invoice_number, pageW - 14, 27, { align: "right" });
  doc.text(`Statut: ${STATUS_LABELS[inv.status] ?? inv.status}`, pageW - 14, 33, { align: "right" });

  // Customer + dates
  let y = 48;
  doc.setFont("helvetica", "bold"); doc.text("Facturé à :", 14, y);
  doc.setFont("helvetica", "normal");
  if (inv.customer) {
    y += 6; doc.text(inv.customer.name, 14, y);
    if (inv.customer.address) { y += 5; doc.text(inv.customer.address, 14, y); }
    if (inv.customer.postal_code || inv.customer.city) { y += 5; doc.text(`${inv.customer.postal_code ?? ""} ${inv.customer.city ?? ""}`.trim(), 14, y); }
    if (inv.customer.email) { y += 5; doc.text(inv.customer.email, 14, y); }
    if (inv.customer.phone) { y += 5; doc.text(inv.customer.phone, 14, y); }
  }

  doc.setFont("helvetica", "bold"); doc.text("Date facture :", pageW - 70, 48);
  doc.setFont("helvetica", "normal"); doc.text(inv.invoice_date, pageW - 14, 48, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.text("Échéance :", pageW - 70, 54);
  doc.setFont("helvetica", "normal"); doc.text(inv.due_date, pageW - 14, 54, { align: "right" });

  // Items table
  autoTable(doc, {
    startY: Math.max(y + 10, 80),
    head: [["Description", "Qté", "PU", "TVA %", "Rem %", "Total HT"]],
    body: inv.items.map(it => [
      it.description,
      String(it.quantity),
      fmt(it.unit_price),
      `${it.tax_rate}%`,
      `${it.discount_rate}%`,
      fmt(it.line_total_ht),
    ]),
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  // Totals
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  const labelX = pageW - 70;
  const valX = pageW - 14;
  doc.setFontSize(10);
  doc.text("Sous-total HT :", labelX, finalY); doc.text(fmt(inv.subtotal_ht), valX, finalY, { align: "right" });
  doc.text("TVA :", labelX, finalY + 6); doc.text(fmt(inv.tax_amount), valX, finalY + 6, { align: "right" });
  if (inv.discount_amount > 0) {
    doc.text("Remise :", labelX, finalY + 12); doc.text("-" + fmt(inv.discount_amount), valX, finalY + 12, { align: "right" });
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Total TTC :", labelX, finalY + 22); doc.text(fmt(inv.total_ttc), valX, finalY + 22, { align: "right" });

  if (inv.notes) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("Notes : " + inv.notes, 14, finalY + 35);
  }

  // Footer
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text("Merci pour votre confiance — Nolte Küchen", pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

  doc.save(`${inv.invoice_number}.pdf`);
}
