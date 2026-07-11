import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus, Search, Trash2, Eye, Loader2, ClipboardList, CheckCircle2,
  Truck, XCircle, Clock, AlertTriangle, PackagePlus,
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

export const Route = createFileRoute("/_app/orders/")({
  component: OrdersPage,
});

const CURRENCY = "DH";
const STATUS = {
  pending: { label: "En attente", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  validated: { label: "Validée", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  delivered: { label: "Livrée", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelled: { label: "Annulée", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
} as const;
const PAY = {
  unpaid: { label: "Impayée", className: "bg-rose-500/15 text-rose-700" },
  partial: { label: "Partielle", className: "bg-amber-500/15 text-amber-700" },
  paid: { label: "Payée", className: "bg-emerald-500/15 text-emerald-700" },
} as const;
type OrderStatus = keyof typeof STATUS;
type PayStatus = keyof typeof PAY;

type Order = {
  id: string; order_number: string; customer_id: string | null;
  order_date: string; due_date: string;
  status: OrderStatus; payment_status: PayStatus;
  subtotal_ht: number; tax_amount: number; total_ttc: number; paid_amount: number;
  notes: string | null; warehouse_id: string | null;
  customers: { name: string } | null;
  warehouses: { name: string } | null;
};
type Warehouse = { id: string; name: string };

type Customer = { id: string; name: string };
type Product = { id: string; name: string; selling_price: number };
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

function daysLeft(due: string, status: OrderStatus) {
  if (status === "delivered" || status === "cancelled") return null;
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function OrdersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payFilter, setPayFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [pickerSel, setPickerSel] = useState<Record<string, number>>({});

  const [customerId, setCustomerId] = useState<string>("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders").select("*, customers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Order[];
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

  const totals = useMemo(() => {
    let ht = 0, tva = 0, ttc = 0;
    for (const l of lines) { const c = computeLine(l); ht += c.ht; tva += c.tva; ttc += c.ttc; }
    return { ht, tva, ttc };
  }, [lines]);

  const reset = () => {
    setCustomerId(""); setOrderDate(new Date().toISOString().slice(0, 10));
    setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
    setNotes(""); setLines([emptyLine()]);
  };

  const create = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter(l => l.description && l.quantity > 0);
      if (validLines.length === 0) throw new Error("Ajoutez au moins une ligne");
      if (!customerId) throw new Error("Sélectionnez un client");

      const { data: order, error: e1 } = await supabase.from("orders").insert({
        customer_id: customerId, order_date: orderDate, due_date: dueDate,
        status: "pending", subtotal_ht: totals.ht, tax_amount: totals.tva, total_ttc: totals.ttc,
        notes: notes || null, created_by: user?.id ?? null,
      }).select("id").single();
      if (e1) throw e1;

      const payload = validLines.map(l => {
        const c = computeLine(l);
        return {
          order_id: order.id, product_id: l.product_id, description: l.description,
          quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
          discount_rate: l.discount_rate,
          line_total_ht: c.ht, line_tax: c.tva, line_total_ttc: c.ttc,
        };
      });
      const { error: e2 } = await supabase.from("order_items").insert(payload);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Commande créée");
      qc.invalidateQueries({ queryKey: ["orders"] });
      setOpen(false); reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Statut: ${STATUS[v.status].label}`);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimée"); qc.invalidateQueries({ queryKey: ["orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = orders.filter(o => {
    if (statusFilter !== "all") {
      if (statusFilter === "late") {
        const d = daysLeft(o.due_date, o.status);
        if (d === null || d >= 0) return false;
      } else if (o.status !== statusFilter) return false;
    }
    if (payFilter !== "all" && o.payment_status !== payFilter) return false;
    if (customerFilter !== "all" && o.customer_id !== customerFilter) return false;
    if (dateFrom && o.order_date < dateFrom) return false;
    if (dateTo && o.order_date > dateTo) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return o.order_number.toLowerCase().includes(s) || (o.customers?.name ?? "").toLowerCase().includes(s);
  });

  const kpis = useMemo(() => {
    let pending = 0, validated = 0, delivered = 0, cancelled = 0, late = 0;
    for (const o of filtered) {
      if (o.status === "pending") pending++;
      else if (o.status === "validated") validated++;
      else if (o.status === "delivered") delivered++;
      else if (o.status === "cancelled") cancelled++;
      const d = daysLeft(o.due_date, o.status);
      if (d !== null && d < 0) late++;
    }
    return { pending, validated, delivered, cancelled, late };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Commandes clients</h1>
          <p className="text-sm text-muted-foreground">Cycle de vie, délais et livraison</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nouvelle commande</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle commande</DialogTitle></DialogHeader>
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
              <div><Label>Date commande</Label><Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} /></div>
              <div><Label>Dernier jour</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Produits</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setPickerSel({}); setPickerQ(""); setPickerOpen(true); }}>
                    <PackagePlus className="mr-1 h-3 w-3" /> Plusieurs produits
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}>
                    <Plus className="mr-1 h-3 w-3" /> Ligne
                  </Button>
                </div>
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
              <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div>
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
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Ajouter plusieurs produits</DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Rechercher un produit…" value={pickerQ} onChange={e => setPickerQ(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead className="w-28">Qté</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {products
                    .filter(p => !pickerQ || p.name.toLowerCase().includes(pickerQ.toLowerCase()))
                    .map(p => {
                      const checked = pickerSel[p.id] !== undefined;
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const nx = { ...pickerSel };
                                if (e.target.checked) nx[p.id] = 1;
                                else delete nx[p.id];
                                setPickerSel(nx);
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{p.name}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmt(Number(p.selling_price))}</TableCell>
                          <TableCell>
                            <Input
                              className="h-8"
                              type="number"
                              min={1}
                              disabled={!checked}
                              value={checked ? pickerSel[p.id] : 1}
                              onChange={(e) => setPickerSel({ ...pickerSel, [p.id]: Math.max(1, Number(e.target.value)) })}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <span className="mr-auto text-sm text-muted-foreground self-center">
                {Object.keys(pickerSel).length} sélectionné(s)
              </span>
              <Button variant="outline" onClick={() => setPickerOpen(false)}>Annuler</Button>
              <Button
                disabled={Object.keys(pickerSel).length === 0}
                onClick={() => {
                  const newLines: LineForm[] = Object.entries(pickerSel).map(([pid, qty]) => {
                    const p = products.find(x => x.id === pid)!;
                    return {
                      product_id: p.id, description: p.name, quantity: qty,
                      unit_price: Number(p.selling_price), tax_rate: 20, discount_rate: 0,
                    };
                  });
                  const base = lines.filter(l => l.description || l.unit_price > 0);
                  setLines(base.length ? [...base, ...newLines] : newLines);
                  setPickerOpen(false);
                  toast.success(`${newLines.length} produit(s) ajouté(s)`);
                }}
              >
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={Clock} label="En attente" value={kpis.pending} accent="amber" />
        <Kpi icon={CheckCircle2} label="Validées" value={kpis.validated} accent="blue" />
        <Kpi icon={Truck} label="Livrées" value={kpis.delivered} accent="emerald" />
        <Kpi icon={XCircle} label="Annulées" value={kpis.cancelled} accent="rose" />
        <Kpi icon={AlertTriangle} label="En retard" value={kpis.late} accent="rose" />
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
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              <SelectItem value="late">En retard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={payFilter} onValueChange={setPayFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous paiements</SelectItem>
              {Object.entries(PAY).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
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
          {(q || statusFilter !== "all" || payFilter !== "all" || customerFilter !== "all" || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStatusFilter("all"); setPayFilter("all"); setCustomerFilter("all"); setDateFrom(""); setDateTo(""); }}>Réinitialiser</Button>
          )}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>N°</TableHead><TableHead>Client</TableHead>
              <TableHead>Date</TableHead><TableHead>Dernier jour</TableHead>
              <TableHead>Délai</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Reste</TableHead>
              <TableHead>Statut</TableHead><TableHead>Paiement</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="h-24 text-center text-muted-foreground">Aucune commande</TableCell></TableRow>
              ) : filtered.map(o => {
                const ttc = Number(o.total_ttc), paid = Number(o.paid_amount);
                const d = daysLeft(o.due_date, o.status);
                const dColor = d === null ? "secondary" : d < 0 ? "destructive" : d <= 3 ? "default" : "outline";
                const dLabel = d === null ? "—" : d < 0 ? `${Math.abs(d)}j retard` : d === 0 ? "Aujourd'hui" : `${d}j`;
                const st = STATUS[o.status]; const ps = PAY[o.payment_status];
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                    <TableCell>{o.customers?.name ?? "—"}</TableCell>
                    <TableCell>{new Date(o.order_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{new Date(o.due_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell><Badge variant={dColor as any}>{dLabel}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(ttc)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(paid)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Math.max(0, ttc - paid))}</TableCell>
                    <TableCell><Badge className={st.className} variant="secondary">{st.label}</Badge></TableCell>
                    <TableCell><Badge className={ps.className} variant="secondary">{ps.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" asChild title="Voir">
                          <Link to="/orders/$id" params={{ id: o.id }}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        {o.status === "pending" && (
                          <Button size="icon" variant="ghost" title="Valider" onClick={() => updateStatus.mutate({ id: o.id, status: "validated" })}>
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {(o.status === "pending" || o.status === "validated") && (
                          <Button size="icon" variant="ghost" title="Livrer" onClick={() => updateStatus.mutate({ id: o.id, status: "delivered" })}>
                            <Truck className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {o.status !== "cancelled" && o.status !== "delivered" && (
                          <Button size="icon" variant="ghost" title="Annuler" onClick={() => updateStatus.mutate({ id: o.id, status: "cancelled" })}>
                            <XCircle className="h-4 w-4 text-rose-600" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Supprimer" onClick={() => { if (confirm("Supprimer ?")) remove.mutate(o.id); }}>
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

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent?: string }) {
  const color =
    accent === "emerald" ? "text-emerald-600" :
    accent === "amber" ? "text-amber-600" :
    accent === "rose" ? "text-rose-600" :
    accent === "blue" ? "text-blue-600" : "text-primary";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
    </Card>
  );
}
