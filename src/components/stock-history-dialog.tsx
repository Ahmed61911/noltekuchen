import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Printer, FileDown, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Movement = {
  id: string; created_at: string; product_id: string;
  type: string; quantity: number; reason: string | null;
  user_id: string | null; warehouse_id: string | null;
  stock_before: number | null; stock_after: number | null; document_ref: string | null;
};

type Warehouse = { id: string; name: string };
type Profile = { id: string; full_name: string | null };

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  in: { label: "Entrée", className: "bg-emerald-500/15 text-emerald-700" },
  out: { label: "Sortie", className: "bg-rose-500/15 text-rose-700" },
  sale: { label: "Vente", className: "bg-blue-500/15 text-blue-700" },
  purchase: { label: "Achat", className: "bg-indigo-500/15 text-indigo-700" },
  customer_return: { label: "Retour client", className: "bg-cyan-500/15 text-cyan-700" },
  supplier_return: { label: "Retour fournisseur", className: "bg-orange-500/15 text-orange-700" },
  inventory: { label: "Inventaire", className: "bg-amber-500/15 text-amber-700" },
  transfer: { label: "Transfert", className: "bg-purple-500/15 text-purple-700" },
  damaged: { label: "Endommagé", className: "bg-destructive/15 text-destructive" },
};

export function StockHistoryButton({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Historique des mouvements">
        <History className="h-4 w-4" />
      </Button>
      {open && <StockHistoryDialog open={open} onOpenChange={setOpen} productId={productId} productName={productName} />}
    </>
  );
}

function StockHistoryDialog({ open, onOpenChange, productId, productName }: {
  open: boolean; onOpenChange: (v: boolean) => void; productId: string; productName: string;
}) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: movements = [] } = useQuery({
    queryKey: ["stock_movements", productId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_movements").select("*").eq("product_id", productId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Movement[];
    },
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id,name");
      return (data ?? []) as Warehouse[];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name");
      return (data ?? []) as Profile[];
    },
  });

  const whMap = new Map(warehouses.map(w => [w.id, w.name]));
  const userMap = new Map(profiles.map(p => [p.id, p.full_name ?? ""]));

  const filtered = useMemo(() => movements.filter(m => {
    if (typeFilter !== "all" && m.type !== typeFilter) return false;
    if (warehouseFilter !== "all" && m.warehouse_id !== warehouseFilter) return false;
    if (userFilter !== "all" && m.user_id !== userFilter) return false;
    if (dateFrom && m.created_at < dateFrom) return false;
    if (dateTo && m.created_at > dateTo + "T23:59:59") return false;
    return true;
  }), [movements, typeFilter, warehouseFilter, userFilter, dateFrom, dateTo]);

  const rows = () => filtered.map(m => {
    const d = new Date(m.created_at);
    return [
      d.toLocaleDateString("fr-FR"),
      d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      productName,
      m.warehouse_id ? whMap.get(m.warehouse_id) ?? "—" : "—",
      TYPE_LABELS[m.type]?.label ?? m.type,
      String(m.quantity),
      String(m.stock_before ?? "—"),
      String(m.stock_after ?? "—"),
      m.user_id ? userMap.get(m.user_id) ?? "—" : "—",
      m.document_ref ?? m.reason ?? "—",
    ];
  });

  const exportCsv = () => {
    const header = ["Date", "Heure", "Produit", "Dépôt", "Type", "Qté", "Stock avant", "Stock après", "Utilisateur", "Référence"];
    const csv = [header, ...rows()].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `mouvements-${productName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text(`Historique mouvements - ${productName}`, 14, 15);
    autoTable(doc, {
      startY: 22,
      head: [["Date", "Heure", "Dépôt", "Type", "Qté", "Avant", "Après", "Utilisateur", "Réf."]],
      body: rows().map(r => [r[0], r[1], r[3], r[4], r[5], r[6], r[7], r[8], r[9]]),
      styles: { fontSize: 8 },
    });
    doc.save(`mouvements-${productName}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Historique des mouvements — {productName}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Dépôt" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous dépôts</SelectItem>
              {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Utilisateur" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous utilisateurs</SelectItem>
              {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0, 8)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Du" />
          <Input type="date" className="w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Au" />
          <div className="ms-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><FileSpreadsheet className="me-2 h-4 w-4" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={exportPdf}><FileDown className="me-2 h-4 w-4" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="me-2 h-4 w-4" /> Imprimer</Button>
          </div>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Dépôt</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Avant</TableHead>
                <TableHead className="text-right">Après</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Référence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun mouvement</TableCell></TableRow>
              ) : filtered.map(m => {
                const d = new Date(m.created_at);
                const type = TYPE_LABELS[m.type];
                return (
                  <TableRow key={m.id}>
                    <TableCell>{d.toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell>{m.warehouse_id ? whMap.get(m.warehouse_id) ?? "—" : "—"}</TableCell>
                    <TableCell><Badge className={type?.className ?? ""}>{type?.label ?? m.type}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{m.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{m.stock_before ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{m.stock_after ?? "—"}</TableCell>
                    <TableCell className="text-sm">{m.user_id ? userMap.get(m.user_id) ?? "—" : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.document_ref ?? m.reason ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
