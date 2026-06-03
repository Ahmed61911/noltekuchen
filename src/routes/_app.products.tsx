import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Search, Upload, ImageIcon, Loader2 } from "lucide-react";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
});

type Product = {
  id: string;
  reference: string;
  name: string;
  description: string | null;
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock: number;
  dimensions: string | null;
  image_url: string | null;
};

const empty: Omit<Product, "id"> = {
  reference: "", name: "", description: "",
  purchase_price: 0, selling_price: 0, stock_quantity: 0, min_stock: 5,
  dimensions: "", image_url: "",
};

function ProductsPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, "id">>(empty);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: Omit<Product, "id"> & { id?: string }) => {
      if (p.id) {
        const { error } = await supabase.from("products").update(p).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = products.filter((p) =>
    [p.name, p.reference].some((s) => s.toLowerCase().includes(q.toLowerCase()))
  );

  function startEdit(p: Product) {
    setEditing(p);
    setForm({
      reference: p.reference, name: p.name, description: p.description ?? "",
      purchase_price: p.purchase_price, selling_price: p.selling_price,
      stock_quantity: p.stock_quantity, min_stock: p.min_stock,
      dimensions: p.dimensions ?? "", image_url: p.image_url ?? "",
    });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("products")}</h1>
          <p className="text-sm text-muted-foreground">Catalogue, prix et marges</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="ps-9 w-64" />
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary text-primary-foreground shadow-elegant">
                  <Plus className="me-1 h-4 w-4" /> {t("add_product")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? t("edit_product") : t("add_product")}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("reference")}><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
                  <Field label={t("name")}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                  <Field label={t("purchase_price")}><Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} /></Field>
                  <Field label={t("selling_price")}><Input type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} /></Field>
                  <Field label={t("quantity")}><Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })} /></Field>
                  <Field label={t("min_stock")}><Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} /></Field>
                  <Field label={t("dimensions")}><Input value={form.dimensions ?? ""} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="L × P × H" /></Field>
                  <Field label={t("image_url")}><Input value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></Field>
                  <div className="sm:col-span-2">
                    <Field label={t("description")}><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                  <Button onClick={() => upsert.mutate(editing ? { ...form, id: editing.id } : form)} disabled={upsert.isPending}>
                    {t("save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card className="overflow-hidden shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("reference")}</TableHead>
              <TableHead>{t("name")}</TableHead>
              <TableHead className="text-right">{t("purchase_price")}</TableHead>
              <TableHead className="text-right">{t("selling_price")}</TableHead>
              <TableHead className="text-right">{t("margin")}</TableHead>
              <TableHead className="text-right">{t("quantity")}</TableHead>
              {isAdmin && <TableHead className="text-right">{t("actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">{t("loading")}</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">{t("no_data")}</TableCell></TableRow>
            )}
            {filtered.map((p) => {
              const margin = p.selling_price - p.purchase_price;
              const marginPct = p.purchase_price > 0 ? (margin / p.purchase_price) * 100 : 0;
              const low = p.stock_quantity <= p.min_stock;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">{p.purchase_price.toFixed(2)} €</TableCell>
                  <TableCell className="text-right">{p.selling_price.toFixed(2)} €</TableCell>
                  <TableCell className="text-right">
                    <span className={margin >= 0 ? "text-success" : "text-destructive"}>
                      {margin.toFixed(2)} € ({marginPct.toFixed(0)}%)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {low ? <Badge variant="destructive">{p.stock_quantity}</Badge> : <span>{p.stock_quantity}</span>}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(t("confirm_delete"))) remove.mutate(p.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
