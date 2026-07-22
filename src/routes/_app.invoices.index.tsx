import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, Trash2, Eye, FileDown, Loader2, Receipt, TrendingUp, CheckCircle2, AlertCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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

export const Route = createFileRoute("/_app/invoices/")({
  component: InvoicesPage,
});

const CURRENCY = "DH";
const STATUS = {
  draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
  pending: { label: "En attente", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  paid: { label: "Payée", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelled: { label: "Annulée", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
} as const;
type Status = keyof typeof STATUS;

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  invoice_date: string;
  due_date: string;
  status: Status;
  subtotal_ht: number;
  tax_amount: number;
  discount_amount: number;
  total_ttc: number;
  notes: string | null;
  warehouse_id: string | null;
  customers: { name: string } | null;
  warehouses: { name: string } | null;
};

type Customer = { id: string; name: string };
type Product = { id: string; name: string; reference: string | null; selling_price: number; warehouse_id: string | null; stock_quantity: number };
type Warehouse = { id: string; name: string };


type LineForm = {
  product_id: string | null;
  product_key: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_rate: number;
  warehouse_id: string | null;
};

const emptyLine = (): LineForm => ({
  product_id: null, product_key: null, description: "", quantity: 1, unit_price: 0, tax_rate: 20, discount_rate: 0, warehouse_id: null,
});
const productKey = (p: Product) => (p.reference && p.reference.trim()) ? `ref:${p.reference}` : `name:${p.name}`;

const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n)} ${CURRENCY}`;

function computeLine(l: LineForm) {
  const ht = l.quantity * l.unit_price * (1 - l.discount_rate / 100);
  const tva = ht * (l.tax_rate / 100);
  return { ht, tva, ttc: ht + tva };
}

function InvoicesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
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


  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name), warehouses(name)")
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


  const totals = useMemo(() => {
    let ht = 0, tva = 0, ttc = 0;
    for (const l of lines) { const c = computeLine(l); ht += c.ht; tva += c.tva; ttc += c.ttc; }
    return { ht, tva, ttc };
  }, [lines]);

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

      // 1) Insert invoice as draft first
      const { data: inv, error: e1 } = await supabase.from("invoices").insert({
        customer_id: customerId,
        invoice_date: invoiceDate,
        due_date: dueDate,
        status: "draft",
        subtotal_ht: totals.ht,
        tax_amount: totals.tva,
        total_ttc: totals.ttc,
        notes: notes || null,
        created_by: user?.id ?? null,
        warehouse_id: null,
      }).select("id").single();
      if (e1) throw e1;


      // 2) Insert items
      const itemsPayload = validLines.map(l => {
        const c = computeLine(l);
        return {
          invoice_id: inv.id,
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          discount_rate: l.discount_rate,
          line_total_ht: c.ht,
          line_tax: c.tva,
          line_total_ttc: c.ttc,
          warehouse_id: l.warehouse_id,
        };
      });
      const { error: e2 } = await supabase.from("invoice_items").insert(itemsPayload as never);
      if (e2) throw e2;

      // 3) Update to chosen status (triggers stock if pending/paid)
      if (status !== "draft") {
        const { error: e3 } = await supabase.from("invoices").update({ status }).eq("id", inv.id);
        if (e3) throw e3;
      }
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
      // Revert stock if needed by passing through cancelled first
      const { data: inv } = await supabase.from("invoices").select("status, stock_applied").eq("id", id).single();
      if (inv?.stock_applied) {
        await supabase.from("invoices").update({ status: "cancelled" }).eq("id", id);
      }
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
    if (warehouseFilter !== "all" && i.warehouse_id !== warehouseFilter) return false;
    if (dateFrom && i.invoice_date < dateFrom) return false;
    if (dateTo && i.invoice_date > dateTo) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return i.invoice_number.toLowerCase().includes(s) || (i.customers?.name ?? "").toLowerCase().includes(s);
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Facturation</h1>
          <p className="text-sm text-muted-foreground">Factures clients et encaissements</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nouvelle facture</Button>
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
                  <Plus className="mr-1 h-3 w-3" /> Ligne
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[28%]">Produit / Description</TableHead>
                      <TableHead className="w-[10%]">Qté</TableHead>
                      <TableHead className="w-[14%]">PU</TableHead>
                      <TableHead className="w-[10%]">TVA %</TableHead>
                      <TableHead className="w-[10%]">Rem %</TableHead>
                      <TableHead className="w-[18%] text-right">Total HT</TableHead>
                      <TableHead className="w-[10%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => {
                      const c = computeLine(l);
                      const update = (patch: Partial<LineForm>) => {
                        const nx = [...lines]; nx[idx] = { ...l, ...patch }; setLines(nx);
                      };
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select value={l.product_id ?? "_custom"} onValueChange={(v) => {
                              if (v === "_custom") { update({ product_id: null }); return; }
                              const p = products.find(x => x.id === v);
                              if (p) update({ product_id: p.id, description: p.name, unit_price: Number(p.selling_price) });
                            }}>
                              <SelectTrigger className="h-8 mb-1"><SelectValue placeholder="Produit…" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_custom">— Libre —</SelectItem>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input className="h-8" placeholder="Description" value={l.description} onChange={e => update({ description: e.target.value })} />
                          </TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} step="0.01" value={l.quantity} onChange={e => update({ quantity: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} step="0.01" value={l.unit_price} onChange={e => update({ unit_price: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} max={100} step="0.1" value={l.tax_rate} onChange={e => update({ tax_rate: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} max={100} step="0.1" value={l.discount_rate} onChange={e => update({ discount_rate: Number(e.target.value) })} /></TableCell>
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
                <div className="flex justify-between"><span>Sous-total HT</span><span className="tabular-nums">{fmt(totals.ht)}</span></div>
                <div className="flex justify-between"><span>TVA</span><span className="tabular-nums">{fmt(totals.tva)}</span></div>
                <div className="flex justify-between border-t pt-2 font-semibold text-lg"><span>Total TTC</span><span className="tabular-nums">{fmt(totals.ttc)}</span></div>
              </Card>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer la facture
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard icon={TrendingUp} label="CA total" value={fmt(kpis.totalRevenue)} />
        <KpiCard icon={Receipt} label="CA mois" value={fmt(kpis.monthRevenue)} />
        <KpiCard icon={CheckCircle2} label="Payées" value={String(kpis.paidCount)} accent="emerald" />
        <KpiCard icon={AlertCircle} label="Impayées" value={String(kpis.unpaidCount)} accent="amber" />
        <KpiCard icon={Wallet} label="Reste à encaisser" value={fmt(kpis.outstanding)} />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Rechercher numéro ou client…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="paid">Payée</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
            </SelectContent>
          </Select>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Client" /></SelectTrigger>
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
          {(q || statusFilter !== "all" || customerFilter !== "all" || warehouseFilter !== "all" || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStatusFilter("all"); setCustomerFilter("all"); setWarehouseFilter("all"); setDateFrom(""); setDateTo(""); }}>Réinitialiser</Button>
          )}

        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead><TableHead>Client</TableHead>
              <TableHead>Dépôt</TableHead>
              <TableHead>Date</TableHead><TableHead>Échéance</TableHead>
              <TableHead className="text-right">Total TTC</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune facture</TableCell></TableRow>
            ) : filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.invoice_number}</TableCell>
                <TableCell>{i.customers?.name ?? "—"}</TableCell>
                <TableCell className="text-sm">{i.warehouses?.name ?? "—"}</TableCell>
                <TableCell>{i.invoice_date}</TableCell>

                <TableCell>{i.due_date}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(i.total_ttc))}</TableCell>
                <TableCell>
                  <Select value={i.status} onValueChange={(v) => updateStatus.mutate({ id: i.id, newStatus: v as Status })}>
                    <SelectTrigger className={`h-7 w-32 border-0 ${STATUS[i.status].className}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="paid">Payée</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" asChild>
                    <Link to="/invoices/$id" params={{ id: i.id }}><Eye className="h-4 w-4" /></Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => downloadPdf(i.id)}><FileDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer cette facture ?")) remove.mutate(i.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: typeof Receipt; label: string; value: string; accent?: "emerald" | "amber" }) {
  const color = accent === "emerald" ? "text-emerald-600 bg-emerald-500/10"
    : accent === "amber" ? "text-amber-600 bg-amber-500/10"
    : "text-primary bg-primary/10";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Keep Badge import used
void Badge;
