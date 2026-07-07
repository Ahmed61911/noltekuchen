import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { generateInvoicePdf, type PdfInvoice } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/_app/quotes/$id")({
  component: QuoteDetail,
});

const CURRENCY = "DH";
const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", refused: "Refusé", expired: "Expiré",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-700",
  accepted: "bg-emerald-500/15 text-emerald-700",
  refused: "bg-rose-500/15 text-rose-700",
  expired: "bg-amber-500/15 text-amber-700",
};

const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n)} ${CURRENCY}`;

function QuoteDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const { data: qt, error: e1 } = await supabase.from("quotes").select("*, customers(*)").eq("id", id).single();
      if (e1) throw e1;
      const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", id).order("created_at");
      return { qt, items: items ?? [] };
    },
  });

  if (isLoading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.qt) return <div className="text-center py-20 text-muted-foreground">Devis introuvable</div>;

  const { qt, items } = data;
  const customer = (qt as { customers?: PdfInvoice["customer"] }).customers ?? null;

  const downloadPdf = () => {
    const shape: PdfInvoice = {
      invoice_number: qt.quote_number,
      invoice_date: qt.quote_date,
      due_date: qt.expiry_date ?? qt.quote_date,
      status: qt.status,
      subtotal_ht: Number(qt.subtotal_ht),
      tax_amount: Number(qt.tax),
      discount_amount: Number(qt.discount),
      total_ttc: Number(qt.total_ttc),
      notes: qt.notes,
      customer,
      items: items.map((it) => ({
        description: it.description ?? "",
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        tax_rate: Number(it.tax_rate),
        discount_rate: 0,
        line_total_ht: Number(it.total) / (1 + Number(it.tax_rate) / 100),
        line_total_ttc: Number(it.total),
      })),
    };
    generateInvoicePdf(shape);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/quotes"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{qt.quote_number}</h1>
            <Badge className={STATUS_COLOR[qt.status]}>{STATUS_LABEL[qt.status]}</Badge>
          </div>
        </div>
        <Button onClick={downloadPdf}><FileDown className="me-2 h-4 w-4" /> Télécharger PDF</Button>
      </div>

      <Card>
        <CardContent className="p-6 grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase text-muted-foreground mb-2">Client</p>
            {customer ? (
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-base">{customer.name}</p>
                {customer.address && <p>{customer.address}</p>}
                {(customer.postal_code || customer.city) && <p>{customer.postal_code} {customer.city}</p>}
                {customer.email && <p className="text-muted-foreground">{customer.email}</p>}
                {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
              </div>
            ) : <p className="text-muted-foreground">—</p>}
          </div>
          <div className="md:text-right space-y-1 text-sm">
            <div className="flex md:justify-end gap-3"><span className="text-muted-foreground">Date :</span><span className="font-medium">{qt.quote_date}</span></div>
            <div className="flex md:justify-end gap-3"><span className="text-muted-foreground">Expire :</span><span className="font-medium">{qt.expiry_date ?? "—"}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qté</TableHead>
              <TableHead className="text-right">PU</TableHead>
              <TableHead className="text-right">TVA</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>{it.description}</TableCell>
                <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(it.unit_price))}</TableCell>
                <TableCell className="text-right">{it.tax_rate}%</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(it.total))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span>Sous-total HT</span><span className="tabular-nums">{fmt(Number(qt.subtotal_ht))}</span></div>
            <div className="flex justify-between"><span>TVA</span><span className="tabular-nums">{fmt(Number(qt.tax))}</span></div>
            {Number(qt.discount) > 0 && (
              <div className="flex justify-between"><span>Remise</span><span className="tabular-nums">-{fmt(Number(qt.discount))}</span></div>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold text-lg"><span>Total TTC</span><span className="tabular-nums">{fmt(Number(qt.total_ttc))}</span></div>
          </div>
        </div>
        {qt.notes && (
          <div className="p-6 pt-0">
            <p className="text-xs uppercase text-muted-foreground mb-1">Notes</p>
            <p className="text-sm">{qt.notes}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
