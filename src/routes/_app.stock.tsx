import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ArrowDown, ArrowUp, Printer, AlertTriangle, Download } from "lucide-react";
import { toast } from "@/lib/notify";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { DataPagination, usePagination } from "@/components/data/pagination";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { pdfText } from "@/lib/pdf-safe";

export const Route = createFileRoute("/_app/stock")({
  component: StockPage,
});

// Every movement type mapped to a label and a direction, so entries (incl.
// retours clients) read as "Entrée" and exits (incl. retours fournisseurs) as
// "Sortie" — the list used to fall back to "Sortie" for anything not in/damaged.
const MOVE_META: Record<string, { label: string; dir: "in" | "out" | "damaged" }> = {
  in: { label: "Entrée", dir: "in" },
  purchase: { label: "Achat", dir: "in" },
  customer_return: { label: "Retour client", dir: "in" },
  inventory: { label: "Inventaire", dir: "in" },
  out: { label: "Sortie", dir: "out" },
  sale: { label: "Vente", dir: "out" },
  supplier_return: { label: "Retour fournisseur", dir: "out" },
  damaged: { label: "Endommagé", dir: "damaged" },
};

function StockPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"movements" | "inventory">("movements");
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [unitCost, setUnitCost] = useState<number>(0);
  const [type, setType] = useState<"in" | "out" | "damaged">("in");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  
  // Mouvements filters
  const [productFilter, setProductFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out" | "damaged">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");

  // Inventory filters
  const [inventoryWarehouseFilter, setInventoryWarehouseFilter] = useState("all");

  const { data: products = [] } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id,name,reference,purchase_price,warehouse_id")).data ?? [],
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-list"],
    queryFn: async () => (await supabase.from("warehouses").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });
  const damagedWarehouseId = (warehouses as { id: string; name: string }[]).find((w) => w.name === "Stock endommagé")?.id ?? "";

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id,type,quantity,unit_cost,reason,created_at,product_id,warehouse_id,products(name,reference),warehouses(name)")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });

  const { data: inventory = [], isLoading: isLoadingInventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, reference, name, stock_quantity, damaged_quantity, purchase_price, warehouse_id, warehouses(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");
      if (!productId) throw new Error("Sélectionnez un produit");
      const { error } = await supabase.from("stock_movements").insert({
        product_id: productId, type, quantity, unit_cost: unitCost, reason, user_id: user.id,
        warehouse_id: warehouseId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setProductId(""); setWarehouseId(""); setType("in"); setQuantity(1); setUnitCost(0); setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredMovements = (movements as any[]).filter((m) => {
    if (typeFilter !== "all" && m.type !== typeFilter) return false;
    if (productFilter !== "all" && m.product_id !== productFilter) return false;
    if (warehouseFilter !== "all" && m.warehouse_id !== warehouseFilter) return false;
    if (dateFrom && new Date(m.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(m.created_at) > new Date(dateTo + "T23:59:59")) return false;
    if (q) {
      const s = q.toLowerCase();
      const name = (m.products?.name ?? "").toLowerCase();
      const ref = (m.products?.reference ?? "").toLowerCase();
      const rsn = (m.reason ?? "").toLowerCase();
      if (!name.includes(s) && !ref.includes(s) && !rsn.includes(s)) return false;
    }
    return true;
  });

  const filteredInventory = (inventory as any[]).filter((p) => {
    if (inventoryWarehouseFilter !== "all" && p.warehouse_id !== inventoryWarehouseFilter) return false;
    return true;
  });

  const totalInventoryQty = filteredInventory.reduce((acc, p) => acc + (Number(p.stock_quantity) || 0), 0);
  const totalInventoryDamaged = filteredInventory.reduce((acc, p) => acc + (Number(p.damaged_quantity) || 0), 0);
  const totalInventoryValue = filteredInventory.reduce((acc, p) => acc + ((Number(p.stock_quantity) || 0) * (Number(p.purchase_price) || 0)), 0);

  const pagination = usePagination({
    total: activeTab === "movements" ? filteredMovements.length : filteredInventory.length,
    resetKey: activeTab === "movements" 
      ? `${typeFilter}-${productFilter}-${warehouseFilter}-${dateFrom}-${dateTo}-${q}`
      : `${inventoryWarehouseFilter}`,
  });

  const pagedMovements = pagination.slice(filteredMovements);
  const pagedInventory = pagination.slice(filteredInventory);

  const handlePrintMovements = () => {
    const doc = new jsPDF();
    let title = "Mouvements de stock";
    if (dateFrom && dateTo) {
      title += ` du ${new Date(dateFrom).toLocaleDateString("fr-FR")} au ${new Date(dateTo).toLocaleDateString("fr-FR")}`;
    }
    doc.text(pdfText(title), 14, 15);
    
    const tableData = filteredMovements.map(m => {
      const prod = m.products as any;
      const wh = m.warehouses as any;
      const typeStr = MOVE_META[m.type]?.label ?? m.type;

      return [
        new Date(m.created_at).toLocaleString("fr-FR"),
        pdfText(`${prod?.reference || ""} - ${prod?.name || ""}`),
        pdfText(wh?.name || "—"),
        pdfText(typeStr),
        m.quantity.toString(),
        m.unit_cost ? Number(m.unit_cost).toFixed(2) : "—",
        pdfText(m.reason || "—")
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [["Date", "Produit", "Dépôt", "Type", "Quantité", "Coût", "Motif"]],
      body: tableData,
    });
    doc.save("mouvements-stock.pdf");
  };

  const handleExportCSV = () => {
    const headers = ["Référence", "Nom du produit", "Dépôt", "Quantité en stock", "Prix d'achat (TTC)", "Valeur totale"];
    const rows = filteredInventory.map(p => {
      const val = (Number(p.stock_quantity) || 0) * (Number(p.purchase_price) || 0);
      return [
        p.reference || "",
        p.name || "",
        p.warehouses?.name || "",
        p.stock_quantity || 0,
        p.purchase_price || 0,
        val
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    
    // Add total row
    rows.push([
      "Total",
      "",
      "",
      totalInventoryQty,
      "",
      totalInventoryValue
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n"); // UTF-8 BOM
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "inventaire.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintInventory = () => {
    const doc = new jsPDF();
    doc.text(pdfText("Inventaire"), 14, 15);
    
    const tableData = filteredInventory.map(p => {
      const val = (Number(p.stock_quantity) || 0) * (Number(p.purchase_price) || 0);
      return [
        pdfText(p.reference || ""),
        pdfText(p.name || ""),
        pdfText(p.warehouses?.name || "—"),
        (p.stock_quantity || 0).toString(),
        (p.purchase_price || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH",
        val.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH"
      ];
    });

    tableData.push([
      "Total",
      "",
      "",
      totalInventoryQty.toString(),
      "",
      totalInventoryValue.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH"
    ]);

    autoTable(doc, {
      startY: 25,
      head: [["Référence", "Nom du produit", "Dépôt", "Quantité", "Prix d'achat", "Valeur totale"]],
      body: tableData,
    });
    doc.save("inventaire.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("stock")}</h1>
          <p className="text-sm text-muted-foreground">Gestion du stock et inventaire</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "movements" ? (
            <>
              <Button variant="outline" onClick={handlePrintMovements}>
                <Printer className="me-2 h-4 w-4" /> Imprimer
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary text-primary-foreground shadow-elegant">
                    <Plus className="me-1 h-4 w-4" /> {t("new_movement")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("new_movement")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("product")}</Label>
                      <Select value={productId} onValueChange={(v) => {
                        setProductId(v);
                        // Prefill the unit cost from the product so losses
                        // (endommagé) and entries are valued automatically.
                        const p = products.find((x) => x.id === v) as { purchase_price?: number; warehouse_id?: string | null } | undefined;
                        if (p?.purchase_price != null) setUnitCost(Number(p.purchase_price) || 0);
                        // Auto-select the product's depot (unless the movement is
                        // damaged, which is pinned to the damaged depot).
                        if (type !== "damaged" && p?.warehouse_id) setWarehouseId(p.warehouse_id);
                      }}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("type")}</Label>
                        <Select value={type} onValueChange={(v) => {
                          const nt = v as typeof type;
                          setType(nt);
                          if (nt === "damaged") {
                            // Damaged goods are pinned to the damaged depot.
                            if (damagedWarehouseId) setWarehouseId(damagedWarehouseId);
                          } else {
                            // Back to the selected product's own depot.
                            const p = products.find((x) => x.id === productId) as { warehouse_id?: string | null } | undefined;
                            setWarehouseId(p?.warehouse_id ?? "");
                          }
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in">{t("movement_in")}</SelectItem>
                            <SelectItem value="out">{t("movement_out")}</SelectItem>
                            <SelectItem value="damaged">Endommagé</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("quantity")}</Label>
                        <Input type="number" min={1} value={quantity} step="any" onChange={(e) => setQuantity(Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Coût unitaire</Label>
                        <Input type="number" min={0} value={unitCost} step="any" onChange={(e) => setUnitCost(Number(e.target.value))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Dépôt</Label>
                        <Select value={warehouseId || "_none"} onValueChange={(v) => setWarehouseId(v === "_none" ? "" : v)} disabled={type === "damaged"}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Aucun —</SelectItem>
                            {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("reason")}</Label>
                      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vente, livraison, retour…" />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                    <Button onClick={() => create.mutate()} disabled={create.isPending}>{t("save")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="me-2 h-4 w-4" /> Exporter CSV
              </Button>
              <Button variant="outline" onClick={handlePrintInventory}>
                <Printer className="me-2 h-4 w-4" /> Imprimer PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button variant={activeTab === "movements" ? "default" : "ghost"} onClick={() => { setActiveTab("movements"); pagination.setPage(1); }}>
          Mouvements
        </Button>
        <Button variant={activeTab === "inventory" ? "default" : "ghost"} onClick={() => { setActiveTab("inventory"); pagination.setPage(1); }}>
          Inventaire
        </Button>
      </div>

      <Card className="p-3 shadow-card">
        {activeTab === "movements" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-64" placeholder={t("search")} value={q} onChange={e => setQ(e.target.value)} />
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder={t("product")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous produits</SelectItem>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Dépôt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous dépôts</SelectItem>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="in">{t("movement_in")}</SelectItem>
                <SelectItem value="out">{t("movement_out")}</SelectItem>
                <SelectItem value="damaged">Endommagé</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <Input type="date" className="w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            {(q || productFilter !== "all" || warehouseFilter !== "all" || typeFilter !== "all" || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(""); setProductFilter("all"); setWarehouseFilter("all"); setTypeFilter("all"); setDateFrom(""); setDateTo(""); }}>Réinitialiser</Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={inventoryWarehouseFilter} onValueChange={setInventoryWarehouseFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Dépôt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous dépôts</SelectItem>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {inventoryWarehouseFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setInventoryWarehouseFilter("all")}>Réinitialiser</Button>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden shadow-card">
        {activeTab === "movements" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("product")}</TableHead>
                <TableHead>Dépôt</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead className="text-right">{t("quantity")}</TableHead>
                <TableHead className="text-right">Coût Unitaire</TableHead>
                <TableHead>{t("reason")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{t("loading")}</TableCell></TableRow>}
              {!isLoading && pagedMovements.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{t("no_data")}</TableCell></TableRow>
              )}
              {pagedMovements.map((m) => {
                const prod = m.products as { name?: string; reference?: string } | null;
                const wh = m.warehouses as { name?: string } | null;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("fr-FR")}</TableCell>
                    <TableCell>
                      <div className="font-medium">{prod?.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{prod?.reference}</div>
                    </TableCell>
                    <TableCell className="text-sm">{wh?.name ?? "—"}</TableCell>
                    <TableCell>
                      {(() => {
                        const meta = MOVE_META[m.type] ?? { label: m.type, dir: "out" as const };
                        if (meta.dir === "in") return <Badge className="bg-success/15 text-success hover:bg-success/15"><ArrowDown className="me-1 h-3 w-3" />{meta.label}</Badge>;
                        if (meta.dir === "damaged") return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15"><AlertTriangle className="me-1 h-3 w-3" />{meta.label}</Badge>;
                        return <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/20 dark:bg-warning/15 dark:text-warning"><ArrowUp className="me-1 h-3 w-3" />{meta.label}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {m.unit_cost ? Number(m.unit_cost).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH" : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.reason || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Nom du produit</TableHead>
                <TableHead>Dépôt</TableHead>
                <TableHead className="text-right">Quantité en stock</TableHead>
                <TableHead className="text-right">Endommagé</TableHead>
                <TableHead className="text-right">Prix d'achat (TTC)</TableHead>
                <TableHead className="text-right">Valeur totale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingInventory && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{t("loading")}</TableCell></TableRow>}
              {!isLoadingInventory && pagedInventory.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{t("no_data")}</TableCell></TableRow>
              )}
              {pagedInventory.map((p) => {
                const wh = p.warehouses as { name?: string } | null;
                const val = (Number(p.stock_quantity) || 0) * (Number(p.purchase_price) || 0);
                const dmg = Number(p.damaged_quantity) || 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.reference}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm">{wh?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{p.stock_quantity || 0}</TableCell>
                    <TableCell className="text-right">{dmg > 0 ? <span className="font-medium text-destructive">{dmg}</span> : <span className="text-muted-foreground">0</span>}</TableCell>
                    <TableCell className="text-right text-sm">{(p.purchase_price || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH"}</TableCell>
                    <TableCell className="text-right font-medium">{val.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH"}</TableCell>
                  </TableRow>
                );
              })}
              {!isLoadingInventory && pagedInventory.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3} className="text-right">Total</TableCell>
                  <TableCell className="text-right">{totalInventoryQty}</TableCell>
                  <TableCell className="text-right">{totalInventoryDamaged}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">{totalInventoryValue.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH"}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
      <DataPagination pagination={pagination} />
    </div>
  );
}
