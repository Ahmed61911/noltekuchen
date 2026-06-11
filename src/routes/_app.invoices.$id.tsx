import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { generateInvoicePdf, type PdfInvoice } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/_app/invoices/$id")({
  component: InvoiceDetail,
});

const CURRENCY = "DH";
const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon", pending: "En attente", paid: "Payée", cancelled: "Annulée",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/15 text-amber-700",
  paid: "bg-emerald-500/15 text-emerald-700",
  cancelled: "bg-rose-500/15 text-rose-700",
};

const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n)} ${CURRENCY}`;

function InvoiceDetail() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data: inv, error: e1 } = await supabase
        .from("invoices").select("*, customers(*)").eq("id", id).single();
      if (e1) throw e1;
      const { data: items, error: e2 } = await supabase
        .from("invoice_items").select("*").eq("invoice_id", id).order("created_at");
      if (e2) throw e2;
      return { inv, items: items ?? [] };
    },
  });

  if (isLoading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.inv) return <div className="text-center py-20 text-muted-foreground">Facture introuvable</div>;

  const { inv, items } = data;
  const customer = (inv as { customers?: PdfInvoice["customer"] }).customers ?? null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/invoices"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{inv.invoice_number}</h1>
            <Badge className={STATUS_COLOR[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
          </div>
        </div>
        <Button onClick={() => generateInvoicePdf({ ...(inv as unknown as PdfInvoice), items: items as PdfInvoice["items"] })}>
          <FileDown className="mr-2 h-4 w-4" /> Télécharger PDF
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase text-muted-foreground mb-2">Facturé à</p>
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
            <div className="flex md:justify-end gap-3"><span className="text-muted-foreground">Date facture :</span><span className="font-medium">{inv.invoice_date}</span></div>
            <div className="flex md:justify-end gap-3"><span className="text-muted-foreground">Échéance :</span><span className="font-medium">{inv.due_date}</span></div>
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
              <TableHead className="text-right">Remise</TableHead>
              <TableHead className="text-right">Total HT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>{it.description}</TableCell>
                <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(it.unit_price))}</TableCell>
                <TableCell className="text-right">{it.tax_rate}%</TableCell>
                <TableCell className="text-right">{it.discount_rate}%</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(it.line_total_ht))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span>Sous-total HT</span><span className="tabular-nums">{fmt(Number(inv.subtotal_ht))}</span></div>
            <div className="flex justify-between"><span>TVA</span><span className="tabular-nums">{fmt(Number(inv.tax_amount))}</span></div>
            {Number(inv.discount_amount) > 0 && (
              <div className="flex justify-between"><span>Remise</span><span className="tabular-nums">-{fmt(Number(inv.discount_amount))}</span></div>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold text-lg"><span>Total TTC</span><span className="tabular-nums">{fmt(Number(inv.total_ttc))}</span></div>
          </div>
        </div>
        {inv.notes && (
          <div className="p-6 pt-0">
            <p className="text-xs uppercase text-muted-foreground mb-1">Notes</p>
            <p className="text-sm">{inv.notes}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
