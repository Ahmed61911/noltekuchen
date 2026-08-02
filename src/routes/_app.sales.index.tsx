import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus, Trash2, Eye, FileDown, Printer, Loader2, ShoppingCart,
  TrendingUp, CalendarDays, Wallet, AlertCircle, Receipt, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { computeLine, computeTotals } from "@/lib/money";
import { useConfirm } from "@/components/confirm-dialog";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/data/page-header";
import { ResultCount, SearchField, Toolbar } from "@/components/data/toolbar";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { TableShell, TableStateRow } from "@/components/data/table-shell";
import { TableSkeleton } from "@/components/data/table-skeleton";
import { EmptyState } from "@/components/data/empty-state";
import { ErrorState } from "@/components/data/error-state";

export const Route = createFileRoute("/_app/sales/")({
  component: SalesPage,
});

const CURRENCY = "DH";
// Labels unchanged; only the rendering joins the shared tone scale, which is
// token-based and therefore follows the theme instead of being repainted by
// hand on every screen.
const PAY_STATUS = {
  unpaid: { label: "Impayée", tone: "danger" },
  partial: { label: "Partielle", tone: "warning" },
  paid: { label: "Payée", tone: "success" },
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
  sale_items: { warehouse_id: string | null; warehouses: { name: string } | null }[];
};
type Customer = { id: string; name: string };
type Product = { id: string; name: string; reference: string | null; selling_price: number; warehouse_id: string | null; stock_quantity: number };
type Warehouse = { id: string; name: string };


type LineForm = {
  product_id: string | null; product_key: string | null; description: string; quantity: number;
  unit_price: number; tax_rate: number; discount_rate: number;
  warehouse_id: string | null;
};
const emptyLine = (): LineForm => ({
  product_id: null, product_key: null, description: "", quantity: 1, unit_price: 0, tax_rate: 20, discount_rate: 0, warehouse_id: null,
});
const productKey = (p: Product) => (p.reference && p.reference.trim()) ? `ref:${p.reference}` : `name:${p.name}`;
const fmt = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(Number(n) || 0)} ${CURRENCY}`;

function SalesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);

  const [customerId, setCustomerId] = useState<string>("");
  
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const { data: sales = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales").select("*, customers(name), warehouses(name), sale_items(warehouse_id, warehouses(name))").order("created_at", { ascending: false });
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
      const { data, error } = await supabase.from("products").select("id,name,reference,selling_price,warehouse_id,stock_quantity").order("name");
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

  const totals = useMemo(() => computeTotals(lines), [lines]);

  const resetForm = () => {
    setCustomerId(""); setSaleDate(new Date().toISOString().slice(0, 10));
    setDueDate(""); setMethod("cash"); setPaidAmount(0); setNotes("");
    setLines([emptyLine()]);
  };

  const create = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter(l => l.description && l.quantity > 0);
      if (validLines.length === 0) throw new Error("Ajoutez au moins une ligne");

      // Validate depot & stock per line
      for (const [i, l] of validLines.entries()) {
        if (l.product_key && !l.product_id) {
          throw new Error(`Ligne ${i + 1}: sélectionnez le dépôt du produit`);
        }
        if (l.product_id) {
          if (!l.warehouse_id) throw new Error(`Ligne ${i + 1}: dépôt requis`);
          const p = products.find(x => x.id === l.product_id);
          if (!p) throw new Error(`Ligne ${i + 1}: produit introuvable`);
          if (p.warehouse_id !== l.warehouse_id) {
            const wname = warehouses.find(w => w.id === l.warehouse_id)?.name ?? "";
            throw new Error(`Ligne ${i + 1}: "${p.name}" n'existe pas dans le dépôt ${wname}`);
          }
          if (Number(p.stock_quantity ?? 0) < l.quantity) {
            throw new Error(`Ligne ${i + 1}: stock insuffisant pour "${p.name}" (disponible: ${p.stock_quantity ?? 0})`);
          }
        }
      }

      const ttc = totals.ttc;
      const paid = Math.min(paidAmount || 0, ttc);
      const ps: PayStatus = paid <= 0 ? "unpaid" : paid >= ttc ? "paid" : "partial";

      // One transaction server-side. Previously this was four sequential
      // requests: a failure between them left a sale with no lines (having
      // consumed a sale number), or lines inserted — so stock already
      // deducted — without stock_applied set, which let the same goods be
      // deducted again later and blocked the delete trigger from returning
      // them.
      const { error } = await supabase.rpc("create_sale", {
        _sale: {
          customer_id: customerId || null,
          sale_date: saleDate,
          payment_due_date: dueDate || null,
          payment_method: method,
          payment_status: ps,
          subtotal_ht: totals.ht,
          tax_amount: totals.tva,
          total_ttc: ttc,
          paid_amount: paid,
          notes: notes || null,
          warehouse_id: null,
        },
        _items: validLines.map(l => {
          const c = computeLine(l);
          return {
            product_id: l.product_id, description: l.description,
            quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
            discount_rate: l.discount_rate,
            line_total_ht: c.ht, line_tax: c.tva, line_total_ttc: c.ttc,
            warehouse_id: l.warehouse_id,
          };
        }),
      } as never);
      if (error) throw error;
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
        // The sale already moved these goods out of stock. Marking the origin
        // stops the invoice trigger deducting them a second time.
        source_sale_id: sale.id,
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
    if (warehouseFilter !== "all" && !(s.sale_items ?? []).some(it => it.warehouse_id === warehouseFilter)) return false;
    if (dateFrom && s.sale_date < dateFrom) return false;
    if (dateTo && s.sale_date > dateTo) return false;
    if (!q) return true;
    const x = q.toLowerCase();
    return s.sale_number.toLowerCase().includes(x) || (s.customers?.name ?? "").toLowerCase().includes(x);
  });

  const hasFilters = !!(q || statusFilter !== "all" || methodFilter !== "all" || customerFilter !== "all" || warehouseFilter !== "all" || dateFrom || dateTo);
  const resetFilters = () => {
    setQ(""); setStatusFilter("all"); setMethodFilter("all"); setCustomerFilter("all");
    setWarehouseFilter("all"); setDateFrom(""); setDateTo("");
  };

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
    <div className="space-y-4">
      <PageHeader
        title="Ventes"
        subtitle="Transactions encaissées et facturation rapide"
        actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="elev-brand"><Plus className="me-2 h-4 w-4" /> Nouvelle vente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle vente</DialogTitle></DialogHeader>
            <div className="grid grid-cols-5 gap-3">
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
                <Label>Échéance</Label>
                <Input type="date" value={dueDate} min={saleDate || undefined} onChange={e => setDueDate(e.target.value)} />
              </div>
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
                  <Plus className="me-1 h-3 w-3" /> Ligne
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-[28%]">Produit / Description</TableHead>
                    <TableHead className="w-[15%]">Dépôt</TableHead>
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
                      const depotOptions = l.product_key
                        ? products.filter(p => productKey(p) === l.product_key && Number(p.stock_quantity ?? 0) > 0)
                        : [];
                      const outOfStock = !!l.product_key && depotOptions.length === 0;
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select value={l.product_key ?? "_custom"} onValueChange={(v) => {
                              if (v === "_custom") {
                                upd({ product_id: null, product_key: null, warehouse_id: null, description: "", unit_price: 0 });
                                return;
                              }
                              const matches = products.filter(p => productKey(p) === v);
                              const inStock = matches.filter(p => Number(p.stock_quantity ?? 0) > 0);
                              const first = matches[0];
                              if (!first) return;
                              if (inStock.length === 0) {
                                upd({ product_key: v, product_id: null, warehouse_id: null, description: first.name, unit_price: Number(first.selling_price) });
                                toast.error("Produit indisponible en stock");
                                return;
                              }
                              if (inStock.length === 1) {
                                const p = inStock[0];
                                upd({ product_key: v, product_id: p.id, warehouse_id: p.warehouse_id, description: p.name, unit_price: Number(p.selling_price) });
                              } else {
                                upd({ product_key: v, product_id: null, warehouse_id: null, description: first.name, unit_price: Number(first.selling_price) });
                              }
                            }}>
                              <SelectTrigger className="h-8 mb-1"><SelectValue placeholder="Produit…" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_custom">— Libre —</SelectItem>
                                {Array.from(new Map(products.map(p => [productKey(p), p])).values()).map(p => (
                                  <SelectItem key={productKey(p)} value={productKey(p)}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input className="h-8" placeholder="Description" value={l.description} onChange={e => upd({ description: e.target.value })} />
                            {outOfStock && (
                              <p className="mt-1 text-xs text-rose-600">Produit indisponible en stock</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {!l.product_key ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : outOfStock ? (
                              <span className="text-xs text-rose-600">Indisponible</span>
                            ) : depotOptions.length === 1 ? (
                              <div className="text-xs">
                                <div className="font-medium">{warehouses.find(w => w.id === depotOptions[0].warehouse_id)?.name ?? "—"}</div>
                                <div className="text-muted-foreground">Stock : {depotOptions[0].stock_quantity}</div>
                              </div>
                            ) : (
                              <Select value={l.product_id ?? ""} onValueChange={(v) => {
                                const p = depotOptions.find(x => x.id === v);
                                if (p) upd({ product_id: p.id, warehouse_id: p.warehouse_id, unit_price: Number(p.selling_price) });
                              }}>
                                <SelectTrigger className="h-8"><SelectValue placeholder="Choisir dépôt…" /></SelectTrigger>
                                <SelectContent>
                                  {depotOptions.map(p => {
                                    const wname = warehouses.find(w => w.id === p.warehouse_id)?.name ?? "—";
                                    return <SelectItem key={p.id} value={p.id}>{wname} – Stock : {p.stock_quantity}</SelectItem>;
                                  })}
                                </SelectContent>
                              </Select>
                            )}
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
                {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={TrendingUp} label="Chiffre d'affaires" value={fmt(kpis.revenue)} dense loading={isLoading} />
        <StatCard icon={CalendarDays} label="Ventes du jour" value={fmt(kpis.dayRevenue)} dense loading={isLoading} />
        <StatCard icon={ShoppingCart} label="Ventes du mois" value={fmt(kpis.monthRevenue)} dense loading={isLoading} />
        <StatCard icon={Wallet} label="Encaissé" value={fmt(kpis.encaisse)} tone="success" dense loading={isLoading} />
        <StatCard icon={AlertCircle} label="Restant" value={fmt(kpis.restant)} tone="warning" dense loading={isLoading} />
      </div>

      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Rechercher N° ou client…" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(PAY_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous modes</SelectItem>
            {Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous clients</SelectItem>
            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Dépôt" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous dépôts</SelectItem>
            {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Du" />
        <Input type="date" className="w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Au" />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="me-1 h-3.5 w-3.5" /> Réinitialiser
          </Button>
        )}
        <ResultCount shown={filtered.length} total={sales.length} />
      </Toolbar>

      <TableShell>
        <Table aria-busy={isLoading}>
          <caption className="sr-only">Ventes</caption>
          <TableHeader><TableRow>
            <TableHead>N°</TableHead><TableHead>Client</TableHead>
            <TableHead>Dépôt</TableHead>
            <TableHead>Date</TableHead><TableHead className="text-end">Total</TableHead>
            <TableHead className="text-end">Payé</TableHead><TableHead className="text-end">Reste</TableHead>
            <TableHead>Mode</TableHead><TableHead>Échéance</TableHead>
            <TableHead>Statut</TableHead>
            {/* Onze colonnes : les actions restent au bord de fin même quand le
                tableau défile horizontalement. */}
            <TableHead className="sticky end-0 text-end">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton rows={8} columns={11} />}
            {!isLoading && error && (
              <TableStateRow colSpan={11}>
                <ErrorState title={t("error_load_sales")} error={error} onRetry={() => refetch()} />
              </TableStateRow>
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <TableStateRow colSpan={11}>
                {sales.length === 0 ? (
                  <EmptyState
                    icon={ShoppingCart}
                    title={t("empty_sales")}
                    description={t("empty_sales_desc")}
                    action={
                      <Button size="sm" onClick={() => setOpen(true)}>
                        <Plus className="me-1 h-4 w-4" /> Nouvelle vente
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={ShoppingCart}
                    title={t("state_no_results_title")}
                    description={t("state_no_results_desc").replace("{total}", String(sales.length))}
                    action={
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        <RotateCcw className="me-1 h-3.5 w-3.5" /> {t("state_reset_filters")}
                      </Button>
                    }
                  />
                )}
              </TableStateRow>
            )}
            {!isLoading && !error && filtered.map(s => {
              const ttc = Number(s.total_ttc), paid = Number(s.paid_amount);
              const st = PAY_STATUS[s.payment_status];
              return (
                <TableRow key={s.id} className="group">
                  <TableCell className="font-mono text-sm">
                    <Link to="/sales/$id" params={{ id: s.id }} className="font-medium hover:underline">
                      {s.sale_number}
                    </Link>
                  </TableCell>
                  <TableCell>{s.customers?.name ?? <span className="text-muted-foreground">Comptoir</span>}</TableCell>
                  <TableCell className="text-sm">{Array.from(new Set((s.sale_items ?? []).map(it => it.warehouses?.name).filter(Boolean))).join(", ") || "—"}</TableCell>
                  <TableCell className="tabular-nums">{new Date(s.sale_date).toLocaleDateString("fr-FR")}</TableCell>

                  <TableCell className="text-end tabular-nums">{fmt(ttc)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(paid)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(Math.max(0, ttc - paid))}</TableCell>
                  <TableCell>{METHODS[s.payment_method]}</TableCell>
                  <TableCell className="tabular-nums">{s.payment_due_date ? new Date(s.payment_due_date).toLocaleDateString("fr-FR") : "—"}</TableCell>
                  <TableCell><StatusBadge tone={st.tone} label={st.label} /></TableCell>
                  <TableCell className="sticky end-0 z-10 bg-card text-end group-hover:bg-(--row-hover)">
                    <div className="flex justify-end gap-1 text-muted-foreground [&_button]:h-8 [&_button]:w-8">
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
                      <Button size="icon" variant="ghost" title="Supprimer" onClick={async () => { if (await confirm({ title: `Supprimer la vente ${s.sale_number} ?`, description: "La marchandise vendue sera automatiquement réintégrée au stock.", confirmLabel: "Supprimer", destructive: true })) remove.mutate(s.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}
