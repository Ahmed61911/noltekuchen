import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Plus, Loader2, Send, Save, Trash2, Edit2, FileDown } from "lucide-react";
import { toast } from "@/lib/notify";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { generateQuotePdf, type PdfQuote } from "@/lib/quote-pdf";

export const Route = createFileRoute("/_app/quotes/$id")({
  component: QuoteDetail,
});

const fmt = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(Number(n) || 0)} DH`;

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-slate-500/15 text-slate-700" },
  sent: { label: "Envoyé", className: "bg-blue-500/15 text-blue-700" },
  accepted: { label: "Accepté", className: "bg-emerald-500/15 text-emerald-700" },
  refused: { label: "Refusé", className: "bg-rose-500/15 text-rose-700" },
  expired: { label: "Expiré", className: "bg-amber-500/15 text-amber-700" },
};

function QuoteDetail() {
  const { id } = useParams({ from: "/_app/quotes/$id" });
  const qc = useQueryClient();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [addOpen, setAddOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const { data: quote, error: qErr } = await supabase.from("quotes").select("*, customers(*)").eq("id", id).single();
      if (qErr) throw qErr;
      const { data: items } = await supabase.from("quote_items").select("*, products(name, reference)").eq("quote_id", id).order("created_at");
      return { quote, items: items || [] };
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, reference, selling_price").order("name");
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      // ── When accepting a quote, create an order ──
      if (status === "accepted" && data?.quote.status !== "accepted") {
        const quote = data!.quote;
        const qItems = data!.items;

        // Create the order
        const { data: order, error: orderErr } = await supabase.from("orders").insert({
          customer_id: quote.customer_id,
          quote_id: id,
          order_date: new Date().toISOString().split("T")[0],
          due_date: quote.expiry_date || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          status: "pending",
          payment_status: "unpaid",
          total_ttc: quote.total_ttc,
          paid_amount: 0,
          stock_applied: false,
          notes: `Commande générée depuis le devis ${quote.quote_number}`,
          created_by: user?.id,
        }).select("id, order_number").single();
        if (orderErr) throw orderErr;

        // Map quote_items → order_items
        const orderItems = qItems.map((it: any) => {
            discount_rate: it.discount || 0,
            line_total_ttc: Number(it.total) || 0,
          };
        });
        if (orderItems.length > 0) {
          const { error: oiErr } = await supabase.from("order_items").insert(orderItems);
          if (oiErr) throw oiErr;
        }

        toast.success(`Devis accepté — Commande ${order.order_number} créée !`);
      }

      const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote", id] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const p = products.find(x => x.id === selectedProduct);
      if (!p) throw new Error("Produit invalide");
      const price = Number(unitPrice) || 0;
      const subtotal = price * qty;
      const dVal = (subtotal * discount) / 100;
      const total = subtotal - dVal;
      const { error } = await supabase.from("quote_items").insert({
        quote_id: id, product_id: p.id, quantity: qty,
        unit_price: price, discount, total, description: p.name
      });
      if (error) throw error;
      await recomputeTotals();
    },
    onSuccess: () => {
      toast.success("Ligne ajoutée");
      setAddOpen(false);
      setSelectedProduct(""); setQty(1); setDiscount(0); setUnitPrice(0);
      qc.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("quote_items").delete().eq("id", itemId);
      if (error) throw error;
      await recomputeTotals();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quote", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function recomputeTotals() {
    const { data: items } = await supabase.from("quote_items").select("total").eq("quote_id", id);
    if (!items) return;
    let total_ttc = 0;
    for (const it of items) {
      total_ttc += Number(it.total);
    }
    await supabase.from("quotes").update({
      total_ttc
    }).eq("id", id);
  }

  if (isLoading) return <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.quote) return <div className="p-8 text-center text-muted-foreground">Devis introuvable</div>;

  const { quote, items } = data;
  const isDraft = quote.status === "draft";
  const meta = STATUS_META[quote.status] ?? STATUS_META.draft;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/quotes"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{quote.quote_number}</h1>
              <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Créé le {new Date(quote.quote_date).toLocaleDateString("fr-FR")} · {quote.customers?.name ?? "Prospect"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {quote.status === "draft" && (
            <Button variant="outline" className="text-blue-600 hover:text-blue-700" onClick={() => updateStatus.mutate("sent")}>
              <Send className="me-2 h-4 w-4" /> Marquer envoyé
            </Button>
          )}
          {quote.status === "sent" && (
            <>
              <Button variant="outline" className="text-emerald-600 hover:text-emerald-700" onClick={() => updateStatus.mutate("accepted")}>
                <CheckCircle2 className="me-2 h-4 w-4" /> Accepté
              </Button>
              <Button variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => updateStatus.mutate("refused")}>
                <XCircle className="me-2 h-4 w-4" /> Refusé
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => generateQuotePdf({
            ...quote,
            customer: quote.customers,
            items: items.map((it: any) => ({ ...it, code: it.products?.reference }))
          } as PdfQuote)}>
            <FileDown className="mr-2 h-4 w-4" /> Télécharger PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold tracking-tight">Lignes du devis</h2>
            {isDraft && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="me-2 h-4 w-4" /> Ajouter produit</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Ajouter un produit</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div>
                      <Label>Produit</Label>
                      <Select
                        value={selectedProduct}
                        onValueChange={(val) => {
                          setSelectedProduct(val);
                          const prod = products.find((p) => p.id === val);
                          if (prod?.selling_price) setUnitPrice(prod.selling_price);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => <SelectItem key={p.id} value={p.id}>{p.reference} - {p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div><Label>Prix unitaire (DH)</Label><Input type="number" min={0} value={unitPrice} step="any" onChange={e => setUnitPrice(Number(e.target.value))} /></div>
                      <div><Label>Quantité</Label><Input type="number" min={1} value={qty} step="any" onChange={e => setQty(Number(e.target.value))} /></div>
                      <div><Label>Remise (%)</Label><Input type="number" min={0} max={100} value={discount} step="any" onChange={e => setDiscount(Number(e.target.value))} /></div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
                    <Button onClick={() => addItem.mutate()} disabled={!selectedProduct || addItem.isPending}>Ajouter</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">PU</TableHead>
                <TableHead className="text-center">Qté</TableHead>
                <TableHead className="text-center">Remise</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {isDraft && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Aucune ligne</TableCell></TableRow>
              ) : items.map((it: any) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">
                    <div>{it.description}</div>
                    <div className="text-xs text-muted-foreground">{it.products?.reference}</div>
                  </TableCell>
                  <TableCell className="text-right">{fmt(it.unit_price)}</TableCell>
                  <TableCell className="text-center">{it.quantity}</TableCell>
                  <TableCell className="text-center">{it.discount}%</TableCell>
                  <TableCell className="text-right font-medium">{fmt(it.total)}</TableCell>
                  {isDraft && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-600" onClick={async () => {
                        if (await confirm({ title: "Retirer la ligne", message: "Confirmez-vous ?" })) removeItem.mutate(it.id);
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Résumé financier</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between font-semibold text-lg"><span>Total</span><span>{fmt(quote.total_ttc)}</span></div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Client</h3>
            {quote.customers ? (
              <div className="text-sm">
                <p className="font-medium text-base mb-1">{quote.customers.name}</p>
                {quote.customers.email && <p className="text-muted-foreground">{quote.customers.email}</p>}
                {quote.customers.phone && <p className="text-muted-foreground">{quote.customers.phone}</p>}
                {quote.customers.address && <p className="text-muted-foreground mt-2">{quote.customers.address}</p>}
                {quote.customers.city && <p className="text-muted-foreground">{quote.customers.city}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Prospect — aucun client associé</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
