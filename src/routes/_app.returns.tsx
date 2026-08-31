import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, XCircle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "@/lib/notify";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/data/status-badge";
import { DataPagination, usePagination } from "@/components/data/pagination";
import { round2 } from "@/lib/money";

export const Route = createFileRoute("/_app/returns")({
  component: ReturnsPage,
});

const fmt = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(Number(n) || 0)} DH`;

type ReturnType = "client" | "supplier";
type LineForm = {
  key: string;
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  max?: number; // for lines pulled from a vente
  locked?: boolean; // product cannot be changed (came from a vente)
};

const newLine = (): LineForm => ({
  key: crypto.randomUUID(), product_id: "", description: "", quantity: 1, unit_price: 0,
});

function ReturnsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReturnType>("client");
  const [saleId, setSaleId] = useState<string>("");          // client, linked to a vente
  const [supplierId, setSupplierId] = useState<string>("");  // supplier
  const [clientName, setClientName] = useState("");          // client, standalone
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [damaged, setDamaged] = useState(false); // client return -> damaged depot
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [lines, setLines] = useState<LineForm[]>([newLine()]);
  const [typeFilter, setTypeFilter] = useState<"all" | ReturnType>("all");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses").select("id,name").eq("is_active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("returns")
        .select("*, customers(name), suppliers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["returns", "products"],
    queryFn: async () =>
      (await supabase.from("products").select("id,name,reference,purchase_price").order("name")).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["returns", "sales"],
    queryFn: async () =>
      (await supabase.from("sales").select("id,sale_number,customer_id,customers(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["returns", "suppliers"],
    queryFn: async () =>
      (await supabase.from("suppliers").select("id,name").order("name")).data ?? [],
  });

  // When a vente is chosen, pull its lines so the user just sets return quantities.
  async function loadSaleLines(sid: string) {
    setSaleId(sid);
    if (!sid) { setLines([newLine()]); return; }
    const { data: items } = await supabase
      .from("sale_items")
      .select("product_id, description, quantity, unit_price")
      .eq("sale_id", sid);
    setLines(
      (items ?? []).map((it) => ({
        key: crypto.randomUUID(),
        product_id: it.product_id ?? "",
        description: it.description ?? "",
        quantity: 0,
        unit_price: Number(it.unit_price) || 0,
        max: Number(it.quantity) || 0,
        locked: true,
      })),
    );
  }

  const total = useMemo(
    () => round2(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)),
    [lines],
  );

  function resetForm() {
    setType("client"); setSaleId(""); setSupplierId(""); setClientName("");
    setReturnDate(new Date().toISOString().slice(0, 10)); setReason(""); setDamaged(false); setWarehouseId(""); setLines([newLine()]);
  }

  const create = useMutation({
    mutationFn: async () => {
      const valid = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
      if (valid.length === 0) throw new Error("Ajoutez au moins une ligne avec une quantité");
      for (const l of valid) {
        if (l.max !== undefined && l.quantity > l.max) {
          throw new Error(`La quantité retournée dépasse la quantité vendue (max ${l.max})`);
        }
      }

      let customerId: string | null = null;
      if (type === "client") {
        if (saleId) {
          customerId = (sales.find((s: any) => s.id === saleId)?.customer_id) ?? null;
        } else if (clientName.trim()) {
          const { data: c } = await supabase.from("customers").insert({ name: clientName.trim() }).select("id").single();
          customerId = c?.id ?? null;
        }
      }

      const { error } = await supabase.rpc("create_return", {
        _return: {
          type,
          customer_id: type === "client" ? customerId : null,
          supplier_id: type === "supplier" ? (supplierId || null) : null,
          sale_id: type === "client" ? (saleId || null) : null,
          return_date: returnDate,
          reason: reason || null,
          damaged: type === "client" ? damaged : false,
          warehouse_id: warehouseId || null,
        },
        _items: valid.map((l) => ({
          product_id: l.product_id,
          description: l.description || products.find((p: any) => p.id === l.product_id)?.name || "",
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(type === "client" ? "Avoir client créé" : "Retour fournisseur créé");
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_return", { _return_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Retour annulé");
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = returns.filter((r) => typeFilter === "all" || r.type === typeFilter);
  const pagination = usePagination({ total: filtered.length, resetKey: typeFilter });
  const paged = pagination.slice(filtered);

  const canManualLines = type === "supplier" || (type === "client" && !saleId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Retours & Avoirs</h1>
          <p className="text-sm text-muted-foreground">Retours clients (avoirs) et retours fournisseurs</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="me-1 h-4 w-4" /> Nouveau retour</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouveau retour</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              {/* Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type de retour</Label>
                  <Select value={type} onValueChange={(v) => { setType(v as ReturnType); setSaleId(""); setSupplierId(""); setLines([newLine()]); }}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Retour client (avoir)</SelectItem>
                      <SelectItem value="supplier">Retour fournisseur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" className="mt-1" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Dépôt</Label>
                  <Select value={warehouseId || "_none"} onValueChange={(v) => setWarehouseId(v === "_none" ? "" : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Aucun —</SelectItem>
                      {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Party */}
              {type === "client" ? (
                <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Vente liée (optionnel)</Label>
                    <Select value={saleId || "_none"} onValueChange={(v) => loadSaleLines(v === "_none" ? "" : v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Retour libre" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— Retour libre (sans vente) —</SelectItem>
                        {sales.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.sale_number}{s.customers?.name ? ` · ${s.customers.name}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!saleId && (
                    <div>
                      <Label>Nom du client</Label>
                      <Input className="mt-1" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <Checkbox checked={damaged} onCheckedChange={(v) => setDamaged(!!v)} />
                  <span>Produits endommagés — les envoyer au stock endommagé (pas au stock vendable)</span>
                </label>
                </>
              ) : (
                <div>
                  <Label>Fournisseur</Label>
                  <Select value={supplierId || "_none"} onValueChange={(v) => setSupplierId(v === "_none" ? "" : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Aucun —</SelectItem>
                      {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Lines */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label>Lignes {type === "client" ? "(prix de vente)" : "(coût unitaire)"}</Label>
                  {canManualLines && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setLines([...lines, newLine()])}>
                      <Plus className="me-1 h-3.5 w-3.5" /> Ligne
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div key={l.key} className="grid grid-cols-[1fr_5rem_6rem_2rem] items-center gap-2">
                      {l.locked ? (
                        <div className="truncate text-sm">{l.description || products.find((p: any) => p.id === l.product_id)?.name}</div>
                      ) : (
                        <Select value={l.product_id} onValueChange={(v) => {
                          const p: any = products.find((x: any) => x.id === v);
                          setLines(lines.map((x, j) => j === i ? { ...x, product_id: v, description: p?.name ?? "", unit_price: type === "supplier" ? Number(p?.purchase_price) || 0 : x.unit_price } : x));
                        }}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Produit…" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <Input type="number" min={0} step="any" className="h-8" value={l.quantity}
                        onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))}
                        title={l.max !== undefined ? `Vendu : ${l.max}` : undefined} />
                      <Input type="number" min={0} step="any" className="h-8" value={l.unit_price}
                        disabled={l.locked}
                        onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} />
                      {canManualLines ? (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
                {lines.some((l) => l.max !== undefined) && (
                  <p className="mt-1 text-xs text-muted-foreground">Qté à retourner ≤ qté vendue. Laissez 0 pour ne pas retourner une ligne.</p>
                )}
              </div>

              <div>
                <Label>Motif</Label>
                <Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Produit défectueux, erreur…" />
              </div>

              <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm font-medium">
                <span>Total {type === "client" ? "avoir" : "retour"}</span>
                <span className="tabular-nums">{fmt(total)}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null} Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les retours</SelectItem>
              <SelectItem value="client">Retours clients (avoirs)</SelectItem>
              <SelectItem value="supplier">Retours fournisseurs</SelectItem>
            </SelectContent>
          </Select>
          {typeFilter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setTypeFilter("all")}>
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
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Tiers</TableHead>
              <TableHead className="text-end">Total</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Chargement…</TableCell></TableRow>}
            {!isLoading && paged.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Aucun retour</TableCell></TableRow>
            )}
            {paged.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.return_number}</TableCell>
                <TableCell>
                  {r.type === "client"
                    ? <StatusBadge tone="info" label="Avoir client" />
                    : <StatusBadge tone="warning" label="Retour fournisseur" />}
                </TableCell>
                <TableCell className="tabular-nums">{new Date(r.return_date).toLocaleDateString("fr-FR")}</TableCell>
                <TableCell>{r.customers?.name ?? r.suppliers?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(r.total_ttc)}</TableCell>
                <TableCell>
                  {r.status === "cancelled"
                    ? <StatusBadge tone="neutral" label="Annulé" />
                    : <StatusBadge tone="success" label="Actif" />}
                </TableCell>
                <TableCell className="text-end">
                  {r.status !== "cancelled" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Annuler le retour" onClick={async () => {
                      if (await confirm({ title: `Annuler le retour ${r.return_number} ?`, description: "Le mouvement de stock sera inversé.", confirmLabel: "Annuler le retour", destructive: true })) cancel.mutate(r.id);
                    }}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <DataPagination pagination={pagination} />
    </div>
  );
}
