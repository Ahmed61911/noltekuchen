import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, Loader2, PackageCheck, XCircle, RotateCcw, Wallet, Clock } from "lucide-react";
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
import { useConfirm } from "@/components/confirm-dialog";
import { StatusBadge, type StatusTone } from "@/components/data/status-badge";
import { StatCard } from "@/components/data/stat-card";
import { DataPagination, usePagination } from "@/components/data/pagination";
import { round2 } from "@/lib/money";

export const Route = createFileRoute("/_app/purchases")({
  component: PurchasesPage,
});

const fmt = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(Number(n) || 0)} DH`;

// Le stock n'entre qu'au statut « Reçu » : c'est le trigger
// apply_purchase_order_stock qui crée les mouvements, dans le dépôt de l'achat
// et au coût réel des lignes.
const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Brouillon", tone: "neutral" },
  sent: { label: "Envoyé", tone: "info" },
  confirmed: { label: "Confirmé", tone: "info" },
  preparing: { label: "En préparation", tone: "warning" },
  shipped: { label: "Expédié", tone: "warning" },
  received: { label: "Reçu", tone: "success" },
  cancelled: { label: "Annulé", tone: "neutral" },
};

type LineForm = {
  key: string;
  product_id: string;
  description: string;
  quantity: number;
  unit_cost: number;
};

const newLine = (): LineForm => ({
  key: crypto.randomUUID(), product_id: "", description: "", quantity: 1, unit_cost: 0,
});

function PurchasesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([newLine()]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name), warehouses(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["purchases", "suppliers"],
    queryFn: async () =>
      (await supabase.from("suppliers").select("id,name").order("name")).data ?? [],
  });
  const { data: products = [] } = useQuery({
    queryKey: ["purchases", "products"],
    queryFn: async () =>
      (await supabase.from("products").select("id,name,reference,purchase_price,warehouse_id").order("name")).data ?? [],
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-list"],
    queryFn: async () =>
      (await supabase.from("warehouses").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });

  const total = useMemo(
    () => round2(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0)),
    [lines],
  );

  function resetForm() {
    setSupplierId(""); setWarehouseId(""); setOrderDate(new Date().toISOString().slice(0, 10));
    setExpectedDate(""); setNotes(""); setLines([newLine()]);
  }

  const create = useMutation({
    mutationFn: async () => {
      const valid = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
      if (valid.length === 0) throw new Error("Ajoutez au moins une ligne avec une quantité");
      const { error } = await supabase.rpc("create_purchase_order", {
        _po: {
          supplier_id: supplierId || null,
          warehouse_id: warehouseId || null,
          order_date: orderDate,
          expected_date: expectedDate || null,
          status: "draft",
          notes: notes || null,
        },
        _items: valid.map((l) => ({
          product_id: l.product_id,
          description: l.description || products.find((p: any) => p.id === l.product_id)?.name || "",
          quantity: l.quantity,
          unit_cost: l.unit_cost,
        })),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Achat créé");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      setOpen(false); resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("purchase_orders").update({ status: status as never }).eq("id", id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "received" ? "Achat reçu — stock mis à jour" : "Achat annulé");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Achat supprimé");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = purchases.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (q) {
      const s = q.toLowerCase();
      const num = (p.po_number ?? "").toLowerCase();
      const sup = (p.suppliers?.name ?? "").toLowerCase();
      if (!num.includes(s) && !sup.includes(s)) return false;
    }
    return true;
  });

  const kpis = useMemo(() => {
    let received = 0, pending = 0, spent = 0;
    purchases.forEach((p) => {
      if (p.status === "received") { received++; spent += Number(p.total || 0); }
      else if (p.status !== "cancelled") pending++;
    });
    return { received, pending, spent };
  }, [purchases]);

  const pagination = usePagination({ total: filtered.length, resetKey: `${statusFilter}-${q}` });
  const paged = pagination.slice(filtered);

  const upd = (key: string, patch: Partial<LineForm>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Achats</h1>
          <p className="text-sm text-muted-foreground">
            Commandes fournisseurs — le stock entre à la réception
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nouvel achat</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvel achat</DialogTitle></DialogHeader>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Fournisseur</Label>
                <Select value={supplierId || "_none"} onValueChange={(v) => setSupplierId(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Aucun —</SelectItem>
                    {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dépôt de réception</Label>
                <Select value={warehouseId || "_none"} onValueChange={(v) => setWarehouseId(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Aucun —</SelectItem>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></div>
              <div>
                <Label>Date prévue</Label>
                <Input type="date" value={expectedDate} min={orderDate || undefined} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Produits</Label>
                <Button size="sm" variant="outline" onClick={() => setLines([...lines, newLine()])}>
                  <Plus className="me-1 h-3 w-3" /> Ligne
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-[45%]">Produit / Description</TableHead>
                    <TableHead>Qté</TableHead>
                    <TableHead>Coût unitaire</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {lines.map((l) => (
                      <TableRow key={l.key}>
                        <TableCell>
                          <Select
                            value={l.product_id}
                            onValueChange={(v) => {
                              const p: any = products.find((x: any) => x.id === v);
                              upd(l.key, {
                                product_id: v,
                                description: p?.name ?? "",
                                unit_cost: Number(p?.purchase_price) || 0,
                              });
                              // Le dépôt de réception suit le produit s'il n'est pas déjà choisi.
                              if (!warehouseId && p?.warehouse_id) setWarehouseId(p.warehouse_id);
                            }}
                          >
                            <SelectTrigger className="h-8 mb-1"><SelectValue placeholder="Produit…" /></SelectTrigger>
                            <SelectContent>
                              {products.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input className="h-8" placeholder="Description"
                            value={l.description} onChange={(e) => upd(l.key, { description: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 w-20" type="number" min={0} step="any"
                            value={l.quantity} onChange={(e) => upd(l.key, { quantity: Number(e.target.value) })} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 w-28" type="number" min={0} step="any"
                            value={l.unit_cost} onChange={(e) => upd(l.key, { unit_cost: Number(e.target.value) })} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {fmt((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0))}
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-8 w-8"
                            onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Notes</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="flex flex-col justify-end gap-1 rounded-md border p-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Lignes</span>
                  <span className="tabular-nums">{lines.filter((l) => l.product_id && Number(l.quantity) > 0).length}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span><span className="tabular-nums">{fmt(total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null} Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Wallet} label="Total achats reçus" value={fmt(kpis.spent)} loading={isLoading} />
        <StatCard icon={PackageCheck} label="Achats reçus" value={kpis.received} loading={isLoading} tone="success" />
        <StatCard icon={Clock} label="En cours" value={kpis.pending} loading={isLoading} tone="warning" />
      </div>

      <Card className="p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-64" placeholder="Rechercher (N°, fournisseur)…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {(q || statusFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStatusFilter("all"); }}>
              <RotateCcw className="me-1 h-3.5 w-3.5" /> Réinitialiser
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Dépôt</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-end">Total</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
            )}
            {!isLoading && paged.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                Aucun achat</TableCell></TableRow>
            )}
            {paged.map((p) => {
              const st = STATUS[p.status] ?? STATUS.draft;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm font-medium">{p.po_number}</TableCell>
                  <TableCell>{p.suppliers?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm">{p.warehouses?.name ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{new Date(p.order_date).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell><StatusBadge tone={st.tone} label={st.label} /></TableCell>
                  <TableCell className="text-end tabular-nums font-medium">{fmt(p.total)}</TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1 text-muted-foreground [&_button]:h-8 [&_button]:w-8">
                      {p.status !== "received" && p.status !== "cancelled" && (
                        <Button size="icon" variant="ghost" title="Marquer reçu" onClick={async () => {
                          if (await confirm({
                            title: `Marquer l'achat ${p.po_number} comme reçu ?`,
                            description: "La marchandise entrera en stock dans le dépôt de l'achat, au coût des lignes.",
                            confirmLabel: "Recevoir",
                          })) setStatus.mutate({ id: p.id, status: "received" });
                        }}>
                          <PackageCheck className="h-4 w-4" />
                        </Button>
                      )}
                      {p.status !== "cancelled" && (
                        <Button size="icon" variant="ghost" title="Annuler" onClick={async () => {
                          if (await confirm({
                            title: `Annuler l'achat ${p.po_number} ?`,
                            description: "S'il avait été reçu, la marchandise ressortira du stock.",
                            confirmLabel: "Annuler l'achat", destructive: true,
                          })) setStatus.mutate({ id: p.id, status: "cancelled" });
                        }}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" title="Supprimer" onClick={async () => {
                        if (await confirm({
                          title: `Supprimer l'achat ${p.po_number} ?`,
                          description: "S'il était reçu, la marchandise sera retirée du stock.",
                          confirmLabel: "Supprimer", destructive: true,
                        })) remove.mutate(p.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <DataPagination pagination={pagination} />
    </div>
  );
}
