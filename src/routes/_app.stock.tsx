import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
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

export const Route = createFileRoute("/_app/stock")({
  component: StockPage,
});

function StockPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id,name,reference")).data ?? [],
  });

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id,type,quantity,reason,created_at,products(name,reference)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");
      if (!productId) throw new Error("Sélectionnez un produit");
      const { error } = await supabase.from("stock_movements").insert({
        product_id: productId, type, quantity, reason, user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setProductId(""); setType("in"); setQuantity(1); setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredMovements = (movements as any[]).filter((m) => {
    if (typeFilter !== "all" && m.type !== typeFilter) return false;
    if (productFilter !== "all" && m.products && (m as any).product_id !== productFilter) {
      // movements query doesn't select product_id; match via products name fallback
    }
    if (dateFrom && new Date(m.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(m.created_at) > new Date(dateTo + "T23:59:59")) return false;
    if (q) {
      const s = q.toLowerCase();
      const name = (m.products?.name ?? "").toLowerCase();
      const ref = (m.products?.reference ?? "").toLowerCase();
      const reason = (m.reason ?? "").toLowerCase();
      if (!name.includes(s) && !ref.includes(s) && !reason.includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("stock")}</h1>
          <p className="text-sm text-muted-foreground">Mouvements et historique</p>
        </div>
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
                <Select value={productId} onValueChange={setProductId}>
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
                  <Select value={type} onValueChange={(v) => setType(v as "in" | "out")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">{t("movement_in")}</SelectItem>
                      <SelectItem value="out">{t("movement_out")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("quantity")}</Label>
                  <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
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
      </div>

      <Card className="p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-64" placeholder={t("search")} value={q} onChange={e => setQ(e.target.value)} />
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder={t("product")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous produits</SelectItem>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              <SelectItem value="in">{t("movement_in")}</SelectItem>
              <SelectItem value="out">{t("movement_out")}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" className="w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input type="date" className="w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          {(q || productFilter !== "all" || typeFilter !== "all" || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setProductFilter("all"); setTypeFilter("all"); setDateFrom(""); setDateTo(""); }}>Réinitialiser</Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("product")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead className="text-right">{t("quantity")}</TableHead>
              <TableHead>{t("reason")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">{t("loading")}</TableCell></TableRow>}
            {!isLoading && filteredMovements.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">{t("no_data")}</TableCell></TableRow>
            )}
            {filteredMovements.map((m) => {
              const prod = m.products as { name?: string; reference?: string } | null;
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("fr-FR")}</TableCell>
                  <TableCell>
                    <div className="font-medium">{prod?.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{prod?.reference}</div>
                  </TableCell>
                  <TableCell>
                    {m.type === "in" ? (
                      <Badge className="bg-success/15 text-success hover:bg-success/15"><ArrowDown className="me-1 h-3 w-3" />{t("movement_in")}</Badge>
                    ) : (
                      <Badge className="bg-warning/15 text-warning hover:bg-warning/15"><ArrowUp className="me-1 h-3 w-3" />{t("movement_out")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.reason || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
