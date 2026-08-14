import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Printer, Plus, Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { generateInvoicePdf, type PdfInvoice } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/_app/sales/$id")({
  component: SaleDetail,
});

const fmt = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(Number(n) || 0)} DH`;
const METHODS: Record<string, string> = { cash: "Espèces", card: "Carte", transfer: "Virement", check: "Chèque", credit: "Crédit" };
const PS: Record<string, { l: string; c: string }> = {
  unpaid: { l: "Impayée", c: "bg-rose-500/15 text-rose-700" },
  partial: { l: "Partielle", c: "bg-amber-500/15 text-amber-700" },
  paid: { l: "Payée", c: "bg-emerald-500/15 text-emerald-700" },
};

function SaleDetail() {
  const { id } = useParams({ from: "/_app/sales/$id" });
  const qc = useQueryClient();
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('cash');

  const { data } = useQuery({
    queryKey: ["sale", id],
    queryFn: async () => {
      const { data: sale } = await supabase.from("sales").select("*, customers(*)").eq("id", id).single();
      const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", id);
      const { data: payments } = await supabase.from("sale_payments").select("*").eq("sale_id", id).order("paid_at");
      return { sale, items: items || [], payments: payments || [] };
    },
  });
  const addPayment = useMutation({
    mutationFn: async () => {
      if (payAmount <= 0) throw new Error('Montant invalide');
      const { error } = await supabase.from('sale_payments').insert({
        sale_id: id, amount: payAmount, method: payMethod as any,
      });
      if (error) throw error;
      // DB trigger sync_sale_payment_status handles paid_amount and payment_status
    },
    onSuccess: () => {
      toast.success('Paiement enregistré');
      setPayAmount(0);
      qc.invalidateQueries({ queryKey: ['sale', id] });
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data?.sale) return <div className="p-6">Chargement…</div>;
  const { sale, items, payments } = data;
  const reste = Math.max(0, Number(sale.total_ttc) - Number(sale.paid_amount));

  const print = () => generateInvoicePdf({
    invoice_number: sale.sale_number, invoice_date: sale.sale_date,
    due_date: sale.payment_due_date || sale.sale_date,
    status: sale.payment_status === "paid" ? "paid" : "pending",
    discount_amount: 0, total_ttc: sale.total_ttc, notes: sale.notes,
    customer: sale.customers, items: items as PdfInvoice["items"],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/sales"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="font-display text-2xl font-semibold">{sale.sale_number}</h1>
            <p className="text-sm text-muted-foreground">{new Date(sale.sale_date).toLocaleDateString("fr-FR")}</p>
          </div>
        </div>
        <Button onClick={print}><Printer className="mr-2 h-4 w-4" /> Imprimer</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Client</p>
          <p className="font-medium">{sale.customers?.name ?? "Comptoir"}</p>
          {sale.customers?.email && <p className="text-sm text-muted-foreground">{sale.customers.email}</p>}
          {sale.customers?.phone && <p className="text-sm text-muted-foreground">{sale.customers.phone}</p>}
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Paiement</p>
          <p className="font-medium">{METHODS[sale.payment_method]}</p>
          <Badge className={PS[sale.payment_status].c} variant="secondary">{PS[sale.payment_status].l}</Badge>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex justify-between"><span className="text-sm">Total TTC</span><span className="font-semibold tabular-nums">{fmt(sale.total_ttc)}</span></div>
          <div className="flex justify-between text-sm"><span>Payé</span><span className="tabular-nums">{fmt(sale.paid_amount)}</span></div>
          <div className="flex justify-between text-sm"><span>Reste</span><span className="tabular-nums">{fmt(reste)}</span></div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">Lignes</h2>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Description</TableHead><TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">PU</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.map((it: any) => (
              <TableRow key={it.id}>
                <TableCell>{it.description}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(it.quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(it.unit_price)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(it.line_total_ttc)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">Paiements</h2>
        {sale.payment_status !== 'paid' && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div><Label>Montant</Label><Input type="number" min={0} step="0.01" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} className="w-32" /></div>
            <div><Label>Mode</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => addPayment.mutate()} disabled={addPayment.isPending}>
              {addPayment.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Ajouter
            </Button>
          </div>
        )}
        {payments.length === 0 ? <p className="text-sm text-muted-foreground">Aucun paiement</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Mode</TableHead>
              <TableHead className="text-right">Montant</TableHead><TableHead>Note</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {payments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.paid_at).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>{METHODS[p.method]}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(p.amount)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
