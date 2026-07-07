import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus, Search, Trash2, Eye, FileDown, Loader2, PackageCheck, Clock, TrendingUp, XCircle,
} from "lucide-react";
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

export const Route = createFileRoute("/_app/purchase-orders/")({
  component: PurchaseOrdersPage,
});

const CURRENCY = "DH";
const STATUS = {
  draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
  sent: { label: "Envoyée", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  confirmed: { label: "Confirmée", className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  preparing: { label: "En préparation", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  shipped: { label: "Expédiée", className: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" },
  received: { label: "Reçue", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelled: { label: "Annulée", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
} as const;
type Status = keyof typeof STATUS;

type PO = {
  id: string; po_number: string; supplier_id: string | null;
  order_date: string; expected_date: string | null; received_date: string | null;
  total: number; status: Status; stock_applied: boolean; notes: string | null;
  suppliers: { name: string; email: string | null } | null;
};

type Supplier = { id: string; name: string; email: string | null };
type Product = { id: string; name: string; reference: string; purchase_price: number };

type LineForm = { product_id: string | null; description: string; quantity: number; unit_cost: number };

const emptyLine = (): LineForm => ({ product_id: null, description: "", quantity: 1, unit_cost: 0 });
const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n)} ${CURRENCY}`;

function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [status, setStatus] = useState<Status>("draft");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*, suppliers(name,email)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PO[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id,name,email").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-purchase-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,reference,purchase_price").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const total = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0), [lines]);

  const resetForm = () => {
    setSupplierId(""); setOrderDate(new Date().toISOString().slice(0, 10));
    setExpectedDate(""); setStatus("draft"); setNotes(""); setLines([emptyLine()]);
  };

  const create = useMutation({
    mutationFn: async () => {
      const valid = lines.filter(l => l.description && l.quantity > 0);
      if (valid.length === 0) throw new Error("Ajoutez au moins une ligne");
      if (!supplierId) throw new Error("Sélectionnez un fournisseur");
      const { data: po, error: e1 } = await supabase.from("purchase_orders").insert({
        supplier_id: supplierId,
        order_date: orderDate,
        expected_date: expectedDate || null,
        total,
        status,
        notes: notes || null,
        created_by: user?.id ?? null,
      }).select("id").single();
      if (e1) throw e1;
      const rows = valid.map(l => ({
        purchase_order_id: po.id,
        product_id: l.product_id,
        description: l.description,
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        total: l.quantity * l.unit_cost,
      }));
      const { error: e2 } = await supabase.from("purchase_order_items").insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Commande créée"); qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      setOpen(false); resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: Status }) => {
      const { error } = await supabase.from("purchase_orders").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Statut : ${STATUS[vars.newStatus].label}`);
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimée"); qc.invalidateQueries({ queryKey: ["purchase_orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadPdf = async (id: string) => {
    const { data: po } = await supabase.from("purchase_orders").select("*, suppliers(*)").eq("id", id).single();
    if (!po) return toast.error("Commande introuvable");
    const { data: items } = await supabase.from("purchase_order_items").select("*").eq("purchase_order_id", id);
    const sup = (po as { suppliers?: { name: string; email: string | null; phone: string | null; address: string | null } }).suppliers ?? null;
    generateInvoicePdf({
      invoice_number: po.po_number,
      invoice_date: po.order_date,
      due_date: po.expected_date ?? po.order_date,
      status: po.status,
      subtotal_ht: Number(po.total),
      tax_amount: 0,
      discount_amount: 0,
      total_ttc: Number(po.total),
      notes: po.notes,
      customer: sup ? { name: sup.name, email: sup.email, phone: sup.phone ?? null, address: sup.address ?? null, city: null, postal_code: null } : null,
      items: (items ?? []).map(it => ({
        description: it.description ?? "",
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_cost),
        tax_rate: 0, discount_rate: 0,
        line_total_ht: Number(it.total),
        line_total_ttc: Number(it.total),
      })),
    });
  };

  const sendEmail = (po: PO) => {
    const to = po.suppliers?.email ?? "";
    const subj = encodeURIComponent(`Commande ${po.po_number}`);
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver la commande ${po.po_number} d'un montant de ${fmt(Number(po.total))}.\n\nCordialement,\nNolte Küchen`);
    window.location.href = `mailto:${to}?subject=${subj}&body=${body}`;
  };

  const filtered = pos.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return p.po_number.toLowerCase().includes(s) || (p.suppliers?.name ?? "").toLowerCase().includes(s);
  });

  const kpis = useMemo(() => {
    const totalAmount = pos.reduce((s, p) => s + Number(p.total), 0);
    const inProgress = pos.filter(p => ["sent", "confirmed", "preparing", "shipped"].includes(p.status)).length;
    const received = pos.filter(p => p.status === "received");
    const avgDelay = received.length
      ? Math.round(received.reduce((s, p) => {
          if (!p.received_date) return s;
          return s + (new Date(p.received_date).getTime() - new Date(p.order_date).getTime()) / 86400000;
        }, 0) / received.length)
      : 0;
    return { totalAmount, inProgress, received: received.length, avgDelay };
  }, [pos]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Commandes fournisseurs</h1>
          <p className="text-sm text-muted-foreground">Achats et réceptions</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="me-2 h-4 w-4" /> Nouvelle commande</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle commande fournisseur</DialogTitle></DialogHeader>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <Label>Fournisseur *</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} /></div>
              <div><Label>Livraison prévue</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
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
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[45%]">Produit / Description</TableHead>
                      <TableHead className="w-[15%]">Qté</TableHead>
                      <TableHead className="w-[20%]">Prix d'achat</TableHead>
                      <TableHead className="w-[15%] text-right">Total</TableHead>
                      <TableHead className="w-[5%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => {
                      const t = l.quantity * l.unit_cost;
                      const update = (patch: Partial<LineForm>) => { const nx = [...lines]; nx[idx] = { ...l, ...patch }; setLines(nx); };
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select value={l.product_id ?? "_custom"} onValueChange={v => {
                              if (v === "_custom") { update({ product_id: null }); return; }
                              const p = products.find(x => x.id === v);
                              if (p) update({ product_id: p.id, description: p.name, unit_cost: Number(p.purchase_price) });
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
                          <TableCell><Input className="h-8" type="number" min={0} step="0.01" value={l.unit_cost} onChange={e => update({ unit_cost: Number(e.target.value) })} /></TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(t)}</TableCell>
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
                  <Label>Statut</Label>
                  <Select value={status} onValueChange={v => setStatus(v as Status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS) as Status[]).map(k => <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Card className="p-4 self-start">
                <div className="flex justify-between font-semibold text-lg"><span>Total</span><span className="tabular-nums">{fmt(total)}</span></div>
              </Card>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />} Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Total achats" value={fmt(kpis.totalAmount)} />
        <KpiCard icon={Clock} label="En cours" value={String(kpis.inProgress)} accent="amber" />
        <KpiCard icon={PackageCheck} label="Reçues" value={String(kpis.received)} accent="emerald" />
        <KpiCard icon={Clock} label="Délai moyen" value={`${kpis.avgDelay} j`} />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="ps-8" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {(Object.keys(STATUS) as Status[]).map(k => <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Livraison prévue</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune commande</TableCell></TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.po_number}</TableCell>
                <TableCell>{p.suppliers?.name ?? "—"}</TableCell>
                <TableCell>{p.order_date}</TableCell>
                <TableCell>{p.expected_date ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(p.total))}</TableCell>
                <TableCell>
                  <Select value={p.status} onValueChange={v => updateStatus.mutate({ id: p.id, newStatus: v as Status })}>
                    <SelectTrigger className={`h-7 w-36 border-0 ${STATUS[p.status].className}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS) as Status[]).map(k => <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" asChild>
                    <Link to="/purchase-orders/$id" params={{ id: p.id }}><Eye className="h-4 w-4" /></Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => downloadPdf(p.id)}><FileDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => sendEmail(p)} title="Email"><XCircle className="h-4 w-4 rotate-45" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer ?")) remove.mutate(p.id); }}>
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

function KpiCard({ icon: Icon, label, value, accent }: { icon: typeof PackageCheck; label: string; value: string; accent?: "emerald" | "amber" }) {
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

void Badge;
