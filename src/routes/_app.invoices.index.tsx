import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, Eye, FileDown, Loader2, Receipt, TrendingUp, CheckCircle2, AlertCircle, Wallet, RotateCcw } from "lucide-react";
import { toast } from "@/lib/notify";
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
import { generateInvoicePdf, type PdfInvoice } from "@/lib/invoice-pdf";
import { computeLine, computeTotals } from "@/lib/money";
import { useConfirm } from "@/components/confirm-dialog";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/data/page-header";
import { ResultCount, SearchField, Toolbar } from "@/components/data/toolbar";
import { StatCard } from "@/components/data/stat-card";
import { statusToneClasses } from "@/components/data/status-badge";
import { TableShell, TableStateRow } from "@/components/data/table-shell";
import { TableSkeleton } from "@/components/data/table-skeleton";
import { EmptyState } from "@/components/data/empty-state";
import { ErrorState } from "@/components/data/error-state";
import { DataPagination, usePagination } from "@/components/data/pagination";

export const Route = createFileRoute("/_app/invoices/")({
  component: InvoicesPage,
});

const CURRENCY = "DH";
// Labels unchanged. The status of an invoice is editable in place, so it is a
// Select rather than a badge — but it now wears the same tones as every other
// status in the app, taken from tokens so the dark theme follows.
const STATUS = {
  draft: { label: "Brouillon", tone: "neutral" },
  pending: { label: "En attente", tone: "warning" },
  paid: { label: "Payée", tone: "success" },
  cancelled: { label: "Annulée", tone: "danger" },
} as const;
type Status = keyof typeof STATUS;

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  invoice_date: string;
  due_date: string;
  status: Status;
  total_ttc: number;
  notes: string | null;
  warehouse_id: string | null;
  customers: { name: string } | null;
  warehouses: { name: string } | null;
  invoice_items: { warehouse_id: string | null; warehouses: { name: string } | null }[];
};

type Customer = { id: string; name: string };
type Product = { id: string; name: string; reference: string | null; selling_price: number; warehouse_id: string | null; stock_quantity: number };
type Warehouse = { id: string; name: string };


type LineForm = {
  product_id: string | null;
  product_key: string | null;
  description: string;
  quantity: number;
  unit_price: number; discount_rate: number;
  warehouse_id: string | null;
};

const emptyLine = (): LineForm => ({
  product_id: null, product_key: null, description: "", quantity: 1, unit_price: 0, discount_rate: 0, warehouse_id: null,
});
const productKey = (p: Product) => (p.reference && p.reference.trim()) ? `ref:${p.reference}` : `name:${p.name}`;

const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n)} ${CURRENCY}`;


function InvoicesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState<string>("");
  
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [status, setStatus] = useState<Status>("draft");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);


  const { data: invoices = [], isLoading, error, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name), warehouses(name), invoice_items(warehouse_id, warehouses(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Invoice[];

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
    setCustomerId(""); setInvoiceDate(new Date().toISOString().slice(0, 10));
    setDueDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    setStatus("draft"); setNotes(""); setLines([emptyLine()]);
  };

  const create = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter(l => l.description && l.quantity > 0);
      if (validLines.length === 0) throw new Error("Ajoutez au moins une ligne");
      if (!customerId) throw new Error("Sélectionnez un client");

      // Validate depot & stock per line (only if status will apply stock)
      const willApplyStock = status === "pending" || status === "paid";
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
          if (willApplyStock && Number(p.stock_quantity ?? 0) < l.quantity) {
            throw new Error(`Ligne ${i + 1}: stock insuffisant pour "${p.name}" (disponible: ${p.stock_quantity ?? 0})`);
          }
        }
      }

      // One transaction server-side: header, lines, then the status change
      // that moves stock. Splitting this across three requests could leave an
      // invoice with no lines that had already consumed an invoice number.
      // The RPC still creates it as draft first, so the stock trigger fires
      // only once the lines exist.
      const { error } = await supabase.rpc("create_invoice", {
        _invoice: {
          customer_id: customerId,
          invoice_date: invoiceDate,
          due_date: dueDate,
          status,
          total_ttc: totals.ttc,
          notes: notes || null,
          warehouse_id: null,
        },
        _items: validLines.map(l => {
          const c = computeLine(l);
          return {
            product_id: l.product_id,
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount_rate: l.discount_rate,
            line_total_ttc: c.ttc,
            warehouse_id: l.warehouse_id,
          };
        }),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Facture créée");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false); resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: Status }) => {
      const { error } = await supabase.from("invoices").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Statut: ${STATUS[vars.newStatus].label}`);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Stock reversal is handled by the BEFORE DELETE trigger, so it can't be
      // skipped by whoever deletes. The old cancelled-then-delete round trip
      // did the same job here but was missing on sales and orders entirely.
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimée");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadPdf = async (id: string) => {
    const { data: inv, error: e1 } = await supabase
      .from("invoices").select("*, customers(*)").eq("id", id).single();
    if (e1 || !inv) { toast.error("Facture introuvable"); return; }
    const { data: items, error: e2 } = await supabase
      .from("invoice_items").select("*").eq("invoice_id", id).order("created_at");
    if (e2) { toast.error(e2.message); return; }
    const customer = (inv as { customers?: PdfInvoice["customer"] }).customers ?? null;
    generateInvoicePdf({ ...(inv as unknown as PdfInvoice), customer, items: items as PdfInvoice["items"] });
  };

  // Filter
  const filtered = invoices.filter(i => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (customerFilter !== "all" && i.customer_id !== customerFilter) return false;
    if (warehouseFilter !== "all" && !(i.invoice_items ?? []).some(it => it.warehouse_id === warehouseFilter)) return false;
    if (dateFrom && i.invoice_date < dateFrom) return false;
    if (dateTo && i.invoice_date > dateTo) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return i.invoice_number.toLowerCase().includes(s) || (i.customers?.name ?? "").toLowerCase().includes(s);
  });

  const hasFilters = !!(q || statusFilter !== "all" || customerFilter !== "all" || warehouseFilter !== "all" || dateFrom || dateTo);
  const resetFilters = () => {
    setQ(""); setStatusFilter("all"); setCustomerFilter("all");
    setWarehouseFilter("all"); setDateFrom(""); setDateTo("");
  };

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const month = now.getMonth(); const year = now.getFullYear();
    let totalRevenue = 0, monthRevenue = 0, paidCount = 0, unpaidCount = 0, outstanding = 0;
    for (const i of invoices) {
      if (i.status === "paid") {
        totalRevenue += Number(i.total_ttc); paidCount++;
        const d = new Date(i.invoice_date);
        if (d.getMonth() === month && d.getFullYear() === year) monthRevenue += Number(i.total_ttc);
      } else if (i.status === "pending") {
        unpaidCount++; outstanding += Number(i.total_ttc);
      }
    }
    return { totalRevenue, monthRevenue, paidCount, unpaidCount, outstanding };
  }, [invoices]);

  // Client-side: the query already returns every invoice and the filters run in
  // memory over the whole set; only the rows painted are cut into pages.
  const pagination = usePagination({
    total: filtered.length,
    resetKey: [q, statusFilter, customerFilter, warehouseFilter, dateFrom, dateTo].join(" "),
  });
  const pageRows = pagination.slice(filtered);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Facturation"
        subtitle="Factures clients et encaissements"
        actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="elev-brand"><Plus className="me-2 h-4 w-4" /> Nouvelle facture</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle facture</DialogTitle></DialogHeader>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <Label>Client *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date facture</Label><Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
              <div><Label>Échéance</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
            </div>



            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Produits / Lignes</Label>
                <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}>
                  <Plus className="me-1 h-3 w-3" /> Ligne
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[26%]">Produit / Description</TableHead>
                      <TableHead className="w-[15%]">Dépôt</TableHead>
                      <TableHead className="w-[8%]">Qté</TableHead>
                      <TableHead className="w-[12%]">PU</TableHead>
                      <TableHead className="w-[8%]">TVA %</TableHead>
                      <TableHead className="w-[8%]">Rem %</TableHead>
                      <TableHead className="w-[15%] text-right">Total HT</TableHead>
                      <TableHead className="w-[8%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => {
                      const c = computeLine(l);
                      const update = (patch: Partial<LineForm>) => {
                        const nx = [...lines]; nx[idx] = { ...l, ...patch }; setLines(nx);
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
                                update({ product_id: null, product_key: null, warehouse_id: null, description: "", unit_price: 0 });
                                return;
                              }
                              const matches = products.filter(p => productKey(p) === v);
                              const inStock = matches.filter(p => Number(p.stock_quantity ?? 0) > 0);
                              const first = matches[0];
                              if (!first) return;
                              if (inStock.length === 0) {
                                update({ product_key: v, product_id: null, warehouse_id: null, description: first.name, unit_price: Number(first.selling_price) });
                                toast.error("Produit indisponible en stock");
                                return;
                              }
                              if (inStock.length === 1) {
                                const p = inStock[0];
                                update({ product_key: v, product_id: p.id, warehouse_id: p.warehouse_id, description: p.name, unit_price: Number(p.selling_price) });
                              } else {
                                update({ product_key: v, product_id: null, warehouse_id: null, description: first.name, unit_price: Number(first.selling_price) });
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
                            <Input className="h-8" placeholder="Description" value={l.description} onChange={e => update({ description: e.target.value })} />
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
                                if (p) update({ product_id: p.id, warehouse_id: p.warehouse_id, unit_price: Number(p.selling_price) });
                              }}>
                                <SelectTrigger className="h-8"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                                <SelectContent>
                                  {depotOptions.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {warehouses.find(w => w.id === p.warehouse_id)?.name ?? "—"} · {p.stock_quantity}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} step="0.01" value={l.quantity} onChange={e => update({ quantity: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} step="0.01" value={l.unit_price} onChange={e => update({ unit_price: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} max={100} step="0.1" value={l.discount_rate} onChange={e => update({ discount_rate: Number(e.target.value) })} /></TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmt(c.ttc)}</TableCell>
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
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                <div>
                  <Label>Statut initial</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="paid">Payée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Card className="p-4 space-y-2 self-start">
                <div className="flex justify-between font-semibold text-lg"><span>Total TTC</span><span className="tabular-nums">{fmt(totals.ttc)}</span></div>
              </Card>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                Créer la facture
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={TrendingUp} label="CA total" value={fmt(kpis.totalRevenue)} dense loading={isLoading} />
        <StatCard icon={Receipt} label="CA mois" value={fmt(kpis.monthRevenue)} dense loading={isLoading} />
        <StatCard icon={CheckCircle2} label="Payées" value={String(kpis.paidCount)} tone="success" loading={isLoading} />
        <StatCard icon={AlertCircle} label="Impayées" value={String(kpis.unpaidCount)} tone="warning" loading={isLoading} />
        <StatCard icon={Wallet} label="Reste à encaisser" value={fmt(kpis.outstanding)} dense loading={isLoading} />
      </div>

      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Rechercher numéro ou client…" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="paid">Payée</SelectItem>
            <SelectItem value="cancelled">Annulée</SelectItem>
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
        <ResultCount shown={filtered.length} total={invoices.length} />
      </Toolbar>

      <TableShell>
        <Table aria-busy={isLoading}>
          <caption className="sr-only">Facturation</caption>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead><TableHead>Client</TableHead>
              <TableHead>Dépôt</TableHead>
              <TableHead>Date</TableHead><TableHead>Échéance</TableHead>
              <TableHead className="text-end">Total TTC</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="sticky end-0 text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton rows={8} columns={8} />}
            {!isLoading && error && (
              <TableStateRow colSpan={8}>
                <ErrorState title={t("error_load_invoices")} error={error} onRetry={() => refetch()} />
              </TableStateRow>
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <TableStateRow colSpan={8}>
                {invoices.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title={t("empty_invoices")}
                    description={t("empty_invoices_desc")}
                    action={
                      <Button size="sm" onClick={() => setOpen(true)}>
                        <Plus className="me-1 h-4 w-4" /> Nouvelle facture
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Receipt}
                    title={t("state_no_results_title")}
                    description={t("state_no_results_desc").replace("{total}", String(invoices.length))}
                    action={
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        <RotateCcw className="me-1 h-3.5 w-3.5" /> {t("state_reset_filters")}
                      </Button>
                    }
                  />
                )}
              </TableStateRow>
            )}
            {!isLoading && !error && pageRows.map(i => (
              <TableRow key={i.id} className="group">
                <TableCell className="font-medium">
                  <Link to="/invoices/$id" params={{ id: i.id }} className="hover:underline">
                    {i.invoice_number}
                  </Link>
                </TableCell>
                <TableCell>{i.customers?.name ?? "—"}</TableCell>
                <TableCell className="text-sm">{Array.from(new Set((i.invoice_items ?? []).map(it => it.warehouses?.name).filter(Boolean))).join(", ") || "—"}</TableCell>
                <TableCell className="tabular-nums">{i.invoice_date}</TableCell>

                <TableCell className="tabular-nums">{i.due_date}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(i.total_ttc))}</TableCell>
                <TableCell>
                  <Select value={i.status} onValueChange={async (v) => { const s = v as Status; const moves = (s === "pending" || s === "paid") !== (i.status === "pending" || i.status === "paid"); if (await confirm({ title: `Passer la facture ${i.invoice_number} en « ${STATUS[s].label} » ?`, description: moves ? (s === "pending" || s === "paid" ? "La marchandise facturée sera sortie du stock." : "La marchandise facturée sera réintégrée au stock.") : "Le stock n'est pas affecté par ce changement.", confirmLabel: "Changer le statut", destructive: s === "cancelled" })) updateStatus.mutate({ id: i.id, newStatus: s }); }}>
                    {/* The trigger keeps its border instead of `border-0`: it is
                        an editable control, and it must read as one while still
                        wearing the shared status tone. */}
                    <SelectTrigger className={`h-7 w-32 text-xs font-semibold ${statusToneClasses[STATUS[i.status].tone]}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="paid">Payée</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="sticky end-0 z-10 bg-card text-end group-hover:bg-(--row-hover)">
                  <div className="flex justify-end gap-1 text-muted-foreground [&_button]:h-8 [&_button]:w-8">
                    <Button size="icon" variant="ghost" asChild title="Voir">
                      <Link to="/invoices/$id" params={{ id: i.id }}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    <Button size="icon" variant="ghost" title="PDF" onClick={() => downloadPdf(i.id)}><FileDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Supprimer" onClick={async () => { if (await confirm({ title: `Supprimer la facture ${i.invoice_number} ?`, description: "Si elle avait sorti la marchandise du stock, celle-ci sera automatiquement réintégrée.", confirmLabel: "Supprimer", destructive: true })) remove.mutate(i.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>

      <DataPagination pagination={pagination} />
    </div>
  );
}
