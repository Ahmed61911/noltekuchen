import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus, Search, Trash2, Eye, FileDown, Printer, Loader2, ShoppingCart,
  TrendingUp, CalendarDays, Wallet, AlertCircle, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateInvoicePdf, type PdfInvoice } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/_app/sales/")({
  component: SalesPage,
});

const CURRENCY = "DH";
const PAY_STATUS = {
  unpaid: { label: "Impayée", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  partial: { label: "Partielle", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  paid: { label: "Payée", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
} as const;
const METHODS = {
  cash: "Espèces", card: "Carte", transfer: "Virement", check: "Chèque", credit: "Crédit",
} as const;
type PayStatus = keyof typeof PAY_STATUS;
type Method = keyof typeof METHODS;

type Sale = {
  id: string; sale_number: string; customer_id: string | null;
  sale_date: string; payment_due_date: string | null;
  payment_method: Method; payment_status: PayStatus;
  subtotal_ht: number; tax_amount: number; total_ttc: number; paid_amount: number;
  invoice_id: string | null; notes: string | null;
  warehouse_id: string | null;
  customers: { name: string } | null;
  warehouses: { name: string } | null;
};
type Customer = { id: string; name: string };
type Product = { id: string; name: string; selling_price: number };
type Warehouse = { id: string; name: string };


type LineForm = {
  product_id: string | null; description: string; quantity: number;
  unit_price: number; tax_rate: number; discount_rate: number;
};
const emptyLine = (): LineForm => ({
  product_id: null, description: "", quantity: 1, unit_price: 0, tax_rate: 20, discount_rate: 0,
});
const fmt = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(Number(n) || 0)} ${CURRENCY}`;
const computeLine = (l: LineForm) => {
  const ht = l.quantity * l.unit_price * (1 - l.discount_rate / 100);
  const tva = ht * (l.tax_rate / 100);
  return { ht, tva, ttc: ht + tva };
};

function SalesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);

  const [customerId, setCustomerId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales").select("*, customers(name), warehouses(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Sale[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name").order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,selling_price").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id,name").eq("is_active", true).order("name");
      return (data ?? []) as Warehouse[];
    },
  });

  const totals = useMemo(() => {
    let ht = 0, tva = 0, ttc = 0;
    for (const l of lines) { const c = computeLine(l); ht += c.ht; tva += c.tva; ttc += c.ttc; }
    return { ht, tva, ttc };
  }, [lines]);

  const resetForm = () => {
    setCustomerId(""); setWarehouseId(""); setSaleDate(new Date().toISOString().slice(0, 10));
    setDueDate(""); setMethod("cash"); setPaidAmount(0); setNotes("");
    setLines([emptyLine()]);
  };

  const create = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter(l => l.description && l.quantity > 0);
      if (validLines.length === 0) throw new Error("Ajoutez au moins une ligne");
      const ttc = totals.ttc;
      const paid = Math.min(paidAmount || 0, ttc);
      const ps: PayStatus = paid <= 0 ? "unpaid" : paid >= ttc ? "paid" : "partial";

      const { data: sale, error: e1 } = await supabase.from("sales").insert({
        customer_id: customerId || null,
        sale_date: saleDate,
        payment_due_date: method === "credit" ? (dueDate || null) : null,
        payment_method: method,
        payment_status: ps,
        subtotal_ht: totals.ht,
        tax_amount: totals.tva,
        total_ttc: ttc,
        paid_amount: paid,
        notes: notes || null,
        created_by: user?.id ?? null,
        warehouse_id: warehouseId || null,
      }).select("id").single();
      if (e1) throw e1;


      const itemsPayload = validLines.map(l => {
        const c = computeLine(l);
        return {
          sale_id: sale.id, product_id: l.product_id, description: l.description,
          quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
          discount_rate: l.discount_rate,
          line_total_ht: c.ht, line_tax: c.tva, line_total_ttc: c.ttc,
        };
      });
      const { error: e2 } = await supabase.from("sale_items").insert(itemsPayload);
      if (e2) throw e2;

      if (paid > 0) {
        await supabase.from("sale_payments").insert({
          sale_id: sale.id, amount: paid, method, created_by: user?.id ?? null,
        });
      }
      await supabase.from("sales").update({ stock_applied: true }).eq("id", sale.id);
    },
    onSuccess: () => {
      toast.success("Vente enregistrée");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false); resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimée"); qc.invalidateQueries({ queryKey: ["sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateInvoice = useMutation({
    mutationFn: async (sale: Sale) => {
      if (sale.invoice_id) throw new Error("Facture déjà générée");
      const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
      const { data: inv, error } = await supabase.from("invoices").insert({
        customer_id: sale.customer_id,
        invoice_date: sale.sale_date,
        due_date: sale.payment_due_date || sale.sale_date,
        status: sale.payment_status === "paid" ? "paid" : "pending",
        subtotal_ht: sale.subtotal_ht, tax_amount: sale.tax_amount, total_ttc: sale.total_ttc,
        notes: `Issue de la vente ${sale.sale_number}`,
        created_by: user?.id ?? null,
        warehouse_id: sale.warehouse_id,
      }).select("id").single();
      if (error) throw error;
      if (items?.length) {
        await supabase.from("invoice_items").insert(items.map((it: any) => ({
          invoice_id: inv.id, product_id: it.product_id, description: it.description,
          quantity: it.quantity, unit_price: it.unit_price, tax_rate: it.tax_rate,
          discount_rate: it.discount_rate,
          line_total_ht: it.line_total_ht, line_tax: it.line_tax, line_total_ttc: it.line_total_ttc,
        })));
      }
      await supabase.from("sales").update({ invoice_id: inv.id }).eq("id", sale.id);
      return inv.id;
    },
    onSuccess: () => { toast.success("Facture générée"); qc.invalidateQueries({ queryKey: ["sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const printSale = async (sale: Sale) => {
    const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    const { data: cust } = sale.customer_id
      ? await supabase.from("customers").select("*").eq("id", sale.customer_id).single()
      : { data: null } as any;
    generateInvoicePdf({
      invoice_number: sale.sale_number, invoice_date: sale.sale_date,
      due_date: sale.payment_due_date || sale.sale_date,
      status: sale.payment_status === "paid" ? "paid" : "pending",
      subtotal_ht: sale.subtotal_ht, tax_amount: sale.tax_amount,
      discount_amount: 0, total_ttc: sale.total_ttc, notes: sale.notes,
      customer: cust, items: (items || []) as PdfInvoice["items"],
    });
  };

  const filtered = sales.filter(s => {
    if (statusFilter !== "all" && s.payment_status !== statusFilter) return false;
    if (methodFilter !== "all" && s.payment_method !== methodFilter) return false;
    if (customerFilter !== "all" && s.customer_id !== customerFilter) return false;
    if (warehouseFilter !== "all" && s.warehouse_id !== warehouseFilter) return false;
    if (dateFrom && s.sale_date < dateFrom) return false;
    if (dateTo && s.sale_date > dateTo) return false;
    if (!q) return true;
    const x = q.toLowerCase();
    return s.sale_number.toLowerCase().includes(x) || (s.customers?.name ?? "").toLowerCase().includes(x);
  });

  const kpis = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const month = now.getMonth(); const year = now.getFullYear();
    let revenue = 0, dayRevenue = 0, monthRevenue = 0, encaisse = 0, restant = 0;
    for (const s of sales) {
      const ttc = Number(s.total_ttc), paid = Number(s.paid_amount);
      revenue += ttc; encaisse += paid; restant += Math.max(0, ttc - paid);
      if (s.sale_date === today) dayRevenue += ttc;
      const d = new Date(s.sale_date);
      if (d.getMonth() === month && d.getFullYear() === year) monthRevenue += ttc;
    }
    return { revenue, dayRevenue, monthRevenue, encaisse, restant };
  }, [sales]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Ventes</h1>
          <p className="text-sm text-muted-foreground">Transactions encaissées et facturation rapide</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nouvelle vente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle vente</DialogTitle></DialogHeader>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <Label>Client</Label>
                <Select value={customerId || "_none"} onValueChange={(v) => setCustomerId(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Comptoir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Comptoir —</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} /></div>
              <div>
                <Label>Mode paiement</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Produits</Label>
                <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}>
                  <Plus className="mr-1 h-3 w-3" /> Ligne
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-[32%]">Produit / Description</TableHead>
                    <TableHead>Qté</TableHead><TableHead>PU</TableHead>
                    <TableHead>TVA %</TableHead><TableHead>Rem %</TableHead>
                    <TableHead className="text-right">Total HT</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => {
                      const c = computeLine(l);
                      const upd = (p: Partial<LineForm>) => {
                        const nx = [...lines]; nx[idx] = { ...l, ...p }; setLines(nx);
                      };
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select value={l.product_id ?? "_custom"} onValueChange={(v) => {
                              if (v === "_custom") { upd({ product_id: null }); return; }
                              const p = products.find(x => x.id === v);
                              if (p) upd({ product_id: p.id, description: p.name, unit_price: Number(p.selling_price) });
                            }}>
                              <SelectTrigger className="h-8 mb-1"><SelectValue placeholder="Produit…" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_custom">— Libre —</SelectItem>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input className="h-8" placeholder="Description" value={l.description} onChange={e => upd({ description: e.target.value })} />
                          </TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} step="0.01" value={l.quantity} onChange={e => upd({ quantity: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} step="0.01" value={l.unit_price} onChange={e => upd({ unit_price: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} max={100} step="0.1" value={l.tax_rate} onChange={e => upd({ tax_rate: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} max={100} step="0.1" value={l.discount_rate} onChange={e => upd({ discount_rate: Number(e.target.value) })} /></TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmt(c.ht)}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label>Montant payé</Label>
                  <Input type="number" min={0} step="0.01" value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value))} />
                </div>
                {method === "credit" && (
                  <div>
                    <Label>Date échéance</Label>
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                )}
                <div>
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                </div>
              </div>
              <Card className="p-4 space-y-2 self-start">
                <div className="flex justify-between"><span>Sous-total HT</span><span className="tabular-nums">{fmt(totals.ht)}</span></div>
                <div className="flex justify-between"><span>TVA</span><span className="tabular-nums">{fmt(totals.tva)}</span></div>
                <div className="flex justify-between border-t pt-2 font-semibold text-lg"><span>Total TTC</span><span className="tabular-nums">{fmt(totals.ttc)}</span></div>
                <div className="flex justify-between text-sm text-muted-foreground"><span>Reste à payer</span><span className="tabular-nums">{fmt(Math.max(0, totals.ttc - (paidAmount || 0)))}</span></div>
              </Card>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={TrendingUp} label="Chiffre d'affaires" value={fmt(kpis.revenue)} />
        <Kpi icon={CalendarDays} label="Ventes du jour" value={fmt(kpis.dayRevenue)} />
        <Kpi icon={ShoppingCart} label="Ventes du mois" value={fmt(kpis.monthRevenue)} />
        <Kpi icon={Wallet} label="Encaissé" value={fmt(kpis.encaisse)} accent="emerald" />
        <Kpi icon={AlertCircle} label="Restant" value={fmt(kpis.restant)} accent="amber" />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Rechercher N° ou client…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {Object.entries(PAY_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous modes</SelectItem>
              {Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous clients</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Du" />
          <Input type="date" className="w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Au" />
          {(q || statusFilter !== "all" || methodFilter !== "all" || customerFilter !== "all" || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStatusFilter("all"); setMethodFilter("all"); setCustomerFilter("all"); setDateFrom(""); setDateTo(""); }}>Réinitialiser</Button>
          )}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>N°</TableHead><TableHead>Client</TableHead>
              <TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Payé</TableHead><TableHead className="text-right">Reste</TableHead>
              <TableHead>Mode</TableHead><TableHead>Échéance</TableHead>
              <TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Aucune vente</TableCell></TableRow>
              ) : filtered.map(s => {
                const ttc = Number(s.total_ttc), paid = Number(s.paid_amount);
                const st = PAY_STATUS[s.payment_status];
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.sale_number}</TableCell>
                    <TableCell>{s.customers?.name ?? <span className="text-muted-foreground">Comptoir</span>}</TableCell>
                    <TableCell>{new Date(s.sale_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(ttc)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(paid)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Math.max(0, ttc - paid))}</TableCell>
                    <TableCell>{METHODS[s.payment_method]}</TableCell>
                    <TableCell>{s.payment_due_date ? new Date(s.payment_due_date).toLocaleDateString("fr-FR") : "—"}</TableCell>
                    <TableCell><Badge className={st.className} variant="secondary">{st.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" asChild title="Voir">
                          <Link to="/sales/$id" params={{ id: s.id }}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button size="icon" variant="ghost" title="Imprimer" onClick={() => printSale(s)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Générer facture"
                          disabled={!!s.invoice_id || generateInvoice.isPending}
                          onClick={() => generateInvoice.mutate(s)}>
                          <Receipt className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="PDF" onClick={() => printSale(s)}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Supprimer" onClick={() => { if (confirm("Supprimer ?")) remove.mutate(s.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: "emerald" | "amber" }) {
  const color = accent === "emerald" ? "text-emerald-600" : accent === "amber" ? "text-amber-600" : "text-primary";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
    </Card>
  );
}
