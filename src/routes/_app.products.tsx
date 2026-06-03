import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Search, Upload, ImageIcon, Loader2, X } from "lucide-react";
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

const MAX_IMAGES = 4;
const CURRENCY = "DH";

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
  images: string[] | null;
};

type FormState = Omit<Product, "id" | "image_url" | "images"> & { gallery: string[] };

const empty: FormState = {
  reference: "", name: "", description: "",
  purchase_price: 0, selling_price: 0, stock_quantity: 0, min_stock: 5,
  dimensions: "", gallery: [],
};

function ProductsPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: FormState & { id?: string }) => {
      const { gallery, ...rest } = p;
      const payload = {
        ...rest,
        image_url: gallery[0] ?? null,
        images: gallery.slice(1),
      };
      if (p.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
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
    const gallery = [p.image_url, ...(p.images ?? [])].filter((x): x is string => !!x);
    setForm({
      reference: p.reference, name: p.name, description: p.description ?? "",
      purchase_price: p.purchase_price, selling_price: p.selling_price,
      stock_quantity: p.stock_quantity, min_stock: p.min_stock,
      dimensions: p.dimensions ?? "", gallery,
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
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <div className="sm:col-span-2">
                    <Field label={`Images (max ${MAX_IMAGES})`}>
                      <GalleryUploadField value={form.gallery} onChange={(g) => setForm({ ...form, gallery: g })} />
                    </Field>
                  </div>
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
              <TableHead className="w-16">Image</TableHead>
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
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">{t("loading")}</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">{t("no_data")}</TableCell></TableRow>
            )}
            {filtered.map((p) => {
              const margin = p.selling_price - p.purchase_price;
              const marginPct = p.purchase_price > 0 ? (margin / p.purchase_price) * 100 : 0;
              const low = p.stock_quantity <= p.min_stock;
              const gallery = [p.image_url, ...(p.images ?? [])].filter((x): x is string => !!x);
              return (
                <TableRow key={p.id}>
                  <TableCell><ProductThumbs paths={gallery} /></TableCell>
                  <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">{p.purchase_price.toFixed(2)} {CURRENCY}</TableCell>
                  <TableCell className="text-right">{p.selling_price.toFixed(2)} {CURRENCY}</TableCell>
                  <TableCell className="text-right">
                    <span className={margin >= 0 ? "text-success" : "text-destructive"}>
                      {margin.toFixed(2)} {CURRENCY} ({marginPct.toFixed(0)}%)
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

const BUCKET = "product-images";

function isHttpUrl(v: string | null | undefined) {
  return !!v && /^https?:\/\//i.test(v);
}

function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["product-image", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 50,
    queryFn: async () => {
      if (!path) return null;
      if (isHttpUrl(path)) return path;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data.signedUrl;
    },
  });
}

function Thumb({ path }: { path: string }) {
  const { data: url } = useSignedUrl(path);
  if (!url) return <div className="h-10 w-10 rounded border bg-muted" />;
  return <img src={url} alt="" className="h-10 w-10 rounded border object-cover" />;
}

function ProductThumbs({ paths }: { paths: string[] }) {
  if (paths.length === 0) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex -space-x-2">
      {paths.slice(0, 4).map((p, i) => (
        <div key={i} className="ring-2 ring-background rounded">
          <Thumb path={p} />
        </div>
      ))}
    </div>
  );
}

function GalleryThumb({ path, onRemove }: { path: string; onRemove: () => void }) {
  const { data: url } = useSignedUrl(path);
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-md border bg-muted">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full" />}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 text-foreground shadow hover:bg-background"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function GalleryUploadField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const remaining = MAX_IMAGES - value.length;

  async function handleFiles(files: FileList) {
    const slots = MAX_IMAGES - value.length;
    if (slots <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images`);
      return;
    }
    const toUpload = Array.from(files).slice(0, slots);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
        if (error) throw error;
        uploaded.push(path);
      }
      onChange([...value, ...uploaded]);
      toast.success("Images téléversées");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((p, i) => (
          <GalleryThumb key={p + i} path={p} onRemove={() => removeAt(i)} />
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="mt-1 text-[10px]">Ajouter</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">{value.length}/{MAX_IMAGES} images. La 1ère sera l'image principale.</p>
    </div>
  );
}

// keep unused import marker to satisfy lint when icon used elsewhere
void useEffect;
