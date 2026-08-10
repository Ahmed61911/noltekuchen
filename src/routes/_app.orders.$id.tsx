import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Truck, XCircle, Plus, Loader2, FileDown } from "lucide-react";
import { toast } from "@/lib/notify";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { generateOrderPdf, type PdfOrder } from "@/lib/order-pdf";

export const Route = createFileRoute("/_app/orders/$id")({
  component: OrderDetail,
});

const fmt = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(Number(n) || 0)} DH`;
const STATUS: Record<string, { l: string; c: string }> = {
  pending: { l: "En attente", c: "bg-amber-500/15 text-amber-700" },
  validated: { l: "Validée", c: "bg-blue-500/15 text-blue-700" },
  delivered: { l: "Livrée", c: "bg-emerald-500/15 text-emerald-700" },
  cancelled: { l: "Annulée", c: "bg-rose-500/15 text-rose-700" },
};
const PS: Record<string, { l: string; c: string }> = {
  unpaid: { l: "Impayée", c: "bg-rose-500/15 text-rose-700" },
  partial: { l: "Partielle", c: "bg-amber-500/15 text-amber-700" },
  paid: { l: "Payée", c: "bg-emerald-500/15 text-emerald-700" },
};
const METHODS: Record<string, string> = { cash: "Espèces", card: "Carte", transfer: "Virement", check: "Chèque", credit: "Crédit" };

function OrderDetail() {
  const { id } = useParams({ from: "/_app/orders/$id" });
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState("cash");

  const { data } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data: order } = await supabase.from("orders").select("*, customers(*)").eq("id", id).single();
      const { data: items } = await supabase.from("order_items").select("*").eq("order_id", id);
      const { data: payments } = await supabase.from("order_payments").select("*").eq("order_id", id).order("paid_at");
      return { order, items: items || [], payments: payments || [] };
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: "pending" | "validated" | "delivered" | "cancelled") => {
      // ── VALIDATED: create invoice + sale (NO stock deduction) ──
      if (status === "validated" && order.status !== "validated") {
        const prefix = "FAC-" + new Date().getFullYear().toString().slice(-2) + (new Date().getMonth() + 1).toString().padStart(2, "0");
        const { data: latest } = await supabase.from("invoices").select("invoice_number").like("invoice_number", `${prefix}-%`).order("invoice_number", { ascending: false }).limit(1).single();
        let nextSeq = 1;
        if (latest?.invoice_number) {
          const parts = latest.invoice_number.split("-");
          nextSeq = parseInt(parts[2], 10) + 1;
        }
        const invNum = `${prefix}-${nextSeq.toString().padStart(4, "0")}`;

        const { data: inv, error: invErr } = await supabase.from("invoices").insert({
          invoice_number: invNum,
          customer_id: order.customer_id,
          invoice_date: new Date().toISOString().split("T")[0],
          due_date: order.due_date,
          status: "draft",
          source_sale_id: order.id,
          subtotal_ht: order.subtotal_ht,
          tax_amount: order.tax_amount,
          total_ttc: order.total_ttc,
          discount_amount: 0,
          created_by: user?.id,
        }).select("id").single();
        if (invErr) throw invErr;

        const invItems = items.map((it: any) => ({
          invoice_id: inv.id, product_id: it.product_id, description: it.description,
          quantity: it.quantity, unit_price: it.unit_price, discount_rate: it.discount_rate,
          tax_rate: it.tax_rate, line_total_ht: it.line_total_ht, line_tax: it.line_tax,
          line_total_ttc: it.line_total_ttc,
        }));
        if (invItems.length > 0) {
          const { error: iiErr } = await supabase.from("invoice_items").insert(invItems);
          if (iiErr) throw iiErr;
        }

        // Create sale record
        const { data: sale, error: saleErr } = await supabase.from("sales").insert({
          customer_id: order.customer_id,
          order_id: order.id,
          invoice_id: inv.id,
          sale_date: new Date().toISOString().split("T")[0],
          payment_due_date: order.due_date,
          payment_method: "cash",
          payment_status: "unpaid",
          subtotal_ht: order.subtotal_ht,
          tax_amount: order.tax_amount,
          total_ttc: order.total_ttc,
          paid_amount: 0,
          stock_applied: false,
          notes: `Vente générée depuis la commande ${order.order_number}`,
          created_by: user?.id,
        }).select("id").single();
        if (saleErr) throw saleErr;

        const saleItems = items.map((it: any) => ({
          sale_id: sale.id, product_id: it.product_id, description: it.description,
          quantity: it.quantity, unit_price: it.unit_price, discount_rate: it.discount_rate,
          tax_rate: it.tax_rate, line_total_ht: it.line_total_ht, line_tax: it.line_tax,
          line_total_ttc: it.line_total_ttc,
        }));
        if (saleItems.length > 0) {
          const { error: siErr } = await supabase.from("sale_items").insert(saleItems);
          if (siErr) throw siErr;
        }
      }

      // ── DELIVERED: deduct stock ──
      if (status === "delivered" && order.status !== "delivered") {
        const movements = items.map((it: any) => ({
          product_id: it.product_id, type: "out" as const, quantity: it.quantity,
          reason: `Livraison - Commande #${order.order_number}`, user_id: user?.id, document_ref: order.order_number,
        }));
        if (movements.length > 0) {
          const { error: smErr } = await supabase.from("stock_movements").insert(movements);
          if (smErr) throw smErr;
        }
        // Mark stock as applied
        await supabase.from("orders").update({ stock_applied: true }).eq("id", id);
      }

      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
      return status;
    },
    onSuccess: (s) => {
      const msgs: Record<string, string> = {
        validated: "Commande validée — facture et vente créées !",
        delivered: "Commande livrée — stock déduit !",
      };
      toast.success(msgs[s] || "Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPayment = useMutation({
    mutationFn: async () => {
      if (amount <= 0) throw new Error("Montant invalide");
      const { error } = await supabase.from("order_payments").insert({
        order_id: id, amount, method: method as "cash" | "card" | "transfer" | "check" | "credit", created_by: user?.id ?? null,
      });
      if (error) throw error;

      // Recalculate paid_amount
      const { data: paymentsData, error: pErr } = await supabase.from("order_payments").select("amount").eq("order_id", id);
      if (pErr) throw pErr;
      
      const newPaidAmount = paymentsData.reduce((acc, p) => acc + Number(p.amount), 0);
      const newStatus = newPaidAmount >= order.total_ttc ? "paid" : (newPaidAmount > 0 ? "partial" : "unpaid");
      
      const { error: oErr } = await supabase.from("orders").update({
        paid_amount: newPaidAmount,
        payment_status: newStatus
      }).eq("id", id);
      if (oErr) throw oErr;
    },
    onSuccess: () => {
      toast.success("Paiement enregistré");
      setAmount(0);
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data?.order) return <div className="p-6">Chargement…</div>;
  const { order, items, payments } = data;
  const reste = Math.max(0, Number(order.total_ttc) - Number(order.paid_amount));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/orders"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="font-display text-2xl font-semibold">{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">Échéance {new Date(order.due_date).toLocaleDateString("fr-FR")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {order.status === "pending" && (
            <Button variant="outline" onClick={async () => { if (await confirm({ title: "Valider cette commande ?", description: "La commande passe en préparation. Le stock sera mouvementé à la livraison.", confirmLabel: "Valider" })) updateStatus.mutate("validated"); }}><CheckCircle2 className="mr-2 h-4 w-4" />Valider</Button>
          )}
          {(order.status === "pending" || order.status === "validated") && (
            <Button onClick={async () => { if (await confirm({ title: "Marquer cette commande comme livrée ?", description: "La marchandise sera immédiatement sortie du stock. En cas d'erreur, l'annulation la réintègre.", confirmLabel: "Livrer" })) updateStatus.mutate("delivered"); }}><Truck className="mr-2 h-4 w-4" />Livrer</Button>
          )}
          {order.status !== "cancelled" && order.status !== "delivered" && (
            <Button variant="outline" onClick={async () => { if (await confirm({ title: "Annuler cette commande ?", description: "Si elle avait déjà été livrée, la marchandise sera réintégrée au stock.", confirmLabel: "Annuler la commande", destructive: true })) updateStatus.mutate("cancelled"); }}><XCircle className="mr-2 h-4 w-4" />Annuler</Button>
          )}
          <Button variant="outline" onClick={() => generateOrderPdf({
            ...order,
            tax: order.tax_amount,
            discount: order.discount_amount || 0,
            customer: order.customers,
            items: items.map((it: any) => ({
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unit_price,
              tax_rate: it.tax_rate,
              discount: it.discount_rate,
              total: it.line_total_ht,
              code: it.products?.reference,
            })),
          } as PdfOrder)}>
            <FileDown className="mr-2 h-4 w-4" /> Bon de commande
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Client</p>
          <p className="font-medium">{order.customers?.name ?? "—"}</p>
          {order.customers?.email && <p className="text-sm text-muted-foreground">{order.customers.email}</p>}
          {order.customers?.phone && <p className="text-sm text-muted-foreground">{order.customers.phone}</p>}
        </Card>
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Statut commande</span>
            <Badge className={STATUS[order.status].c} variant="secondary">{STATUS[order.status].l}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Statut paiement</span>
            <Badge className={PS[order.payment_status].c} variant="secondary">{PS[order.payment_status].l}</Badge>
          </div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex justify-between"><span className="text-sm">Total</span><span className="font-semibold tabular-nums">{fmt(order.total_ttc || order.subtotal_ht)}</span></div>
          <div className="flex justify-between text-sm"><span>Payé</span><span className="tabular-nums">{fmt(order.paid_amount)}</span></div>
          <div className="flex justify-between text-sm"><span>Reste</span><span className="tabular-nums">{fmt(reste)}</span></div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">Produits commandés</h2>
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
                <TableCell className="text-right tabular-nums font-medium">{fmt(it.line_total_ttc || it.line_total_ht)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">Paiements</h2>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div><Label>Montant</Label><Input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-32" /></div>
          <div><Label>Mode</Label>
            <Select value={method} onValueChange={setMethod}>
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
        {payments.length === 0 ? <p className="text-sm text-muted-foreground">Aucun paiement</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Mode</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {payments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.paid_at).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>{METHODS[p.method]}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
