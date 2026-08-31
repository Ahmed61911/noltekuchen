import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Pencil, Trash2, Save, Loader2, ImageIcon, ChevronLeft, ChevronRight, X,
  Package, Tag, DollarSign, Boxes, Ruler, Warehouse, FileText, Barcode,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/audit-log";
import { StockHistoryButton } from "@/components/stock-history-dialog";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_app/products/$id")({
  component: ProductDetailPage,
});

const CURRENCY = "DH";
const BUCKET = "product-images";
const MAX_IMAGES = 4;

type Product = {
  id: string;
  reference: string;
  name: string;
  brand: string | null;
  description: string | null;
  purchase_price: number;
  stock_quantity: number;
  min_stock: number;
  dimensions: string | null;
  image_url: string | null;
  images: string[] | null;
  warehouse_id: string | null;
};

type Warehouse = { id: string; name: string; description: string | null; is_active: boolean };

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

function ProductDetailPage() {
  const { id } = useParams({ from: "/_app/products/$id" });
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [isEditing, setIsEditing] = useState(false);
  const [viewer, setViewer] = useState<{ paths: string[]; index: number } | null>(null);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", "active-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, description, is_active")
        .order("name");
      if (error) throw error;
      return data as Warehouse[];
    },
  });
  const warehouseMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Product;
    },
  });

  const gallery = useMemo(
    () => [product?.image_url, ...(product?.images ?? [])].filter((x): x is string => !!x),
    [product]
  );

  const [form, setForm] = useState<Partial<Product> & { gallery: string[] }>({
    name: "", reference: "", brand: "", description: "",
    purchase_price: 0, min_stock: 5,
    dimensions: "", gallery: [],
  });

  const update = useMutation({
    mutationFn: async (payload: typeof form) => {
      // stock_quantity est retiré explicitement : même si un ancien état du
      // formulaire en contenait, la fiche produit ne doit pas écrire le stock.
      const { gallery, stock_quantity: _ignoredStock, warehouse_id: _ignoredWh, ...rest } = payload;
      const data = {
        ...rest,
        image_url: gallery[0] ?? null,
        images: gallery.slice(1),
      };
      const { error } = await supabase.from("products").update(data).eq("id", id);
      if (error) throw error;
      await logAction({
        action: "update",
        module: "products",
        entity_id: id,
        new_value: data,
        description: `Produit ${data.reference} modifié`,
      });
    },
    onSuccess: () => {
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["product", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setIsEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      await logAction({
        action: "delete",
        module: "products",
        entity_id: id,
        old_value: product as unknown as Record<string, unknown>,
        description: `Produit ${product?.reference ?? id} supprimé`,
      });
    },
    onSuccess: () => {
      toast.success(t("deleted"));
      qc.invalidateQueries({ queryKey: ["products"] });
      window.location.href = "/products";
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit() {
    if (!product) return;
    setForm({
      name: product.name,
      reference: product.reference,
      brand: product.brand ?? "",
      description: product.description ?? "",
      purchase_price: product.purchase_price,
      min_stock: product.min_stock,
      dimensions: product.dimensions ?? "",
      gallery,
    });
    setIsEditing(true);
  }

  if (isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="icon" asChild><Link to="/products"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <p className="text-muted-foreground">{t("no_data")}</p>
      </div>
    );
  }

  const low = product.stock_quantity <= product.min_stock;
  const out = product.stock_quantity === 0;
  const warehouse = product.warehouse_id ? warehouseMap.get(product.warehouse_id) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-1 shrink-0"><Link to="/products"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{product.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Barcode className="h-3.5 w-3.5" />
                {product.reference}
              </span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <StockHistoryButton productId={product.id} productName={product.name} />
            <Button variant="outline" onClick={startEdit}><Pencil className="h-4 w-4 me-1" /> Modifier</Button>
            <Button
              variant="destructive"
              onClick={async () => { if (await confirm({ title: "Supprimer ce produit ?", description: "Son historique de mouvements de stock sera conservé, mais le produit ne sera plus sélectionnable.", confirmLabel: "Supprimer", destructive: true })) remove.mutate(); }}
              disabled={remove.isPending}
            >
              {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 me-1" />}
              {t("delete")}
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <Card className="shadow-card">
          <CardHeader><CardTitle>Modifier le produit</CardTitle></CardHeader>
          <CardContent className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {/* Row 1 — Identity */}
            <Field label={t("product_name") + " *"}>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Hotte décorative Bosch 90 cm" />
            </Field>
            <Field label={t("reference") + " *"}>
              <Input value={form.reference ?? ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Ex : BOS-DWK-90" />
            </Field>

            {/* Row 3 — Pricing */}
            <Field label={t("purchase_price") + " (DH) *"}>
              <Input type="number" min="0" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Math.max(0, Number(e.target.value)) })} />
            </Field>

            {/* Row 4 — Stock */}
            <Field label={t("min_stock") + " *"}>
              <Input type="number" min="0" step="1" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Math.max(0, Math.floor(Number(e.target.value))) })} />
            </Field>

            {/* Full-width fields */}
            <div className="sm:col-span-2">
              <Field label={t("brand")}>
                <Input value={form.brand ?? ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Ex : Bosch" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t("dimensions")}>
                <Input value={form.dimensions ?? ""} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="60 × 40 × 200 cm" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t("description")}>
                <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2 flex gap-2 pt-1">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>{t("cancel")}</Button>
              <Button
                onClick={() => {
                  const errs: string[] = [];
                  if (!form.name?.trim()) errs.push(t("product_name"));
                  if (!form.reference?.trim()) errs.push(t("reference"));
                  if ((form.purchase_price ?? 0) < 0) errs.push("Prix négatif interdit");
                  if ((form.min_stock ?? 0) < 0) errs.push("Quantité négative interdite");
                  if (errs.length) { toast.error("Champs requis : " + errs.join(", ")); return; }
                  const fallbackName = `${form.brand?.trim() ?? ""} ${form.reference?.trim() ?? ""}`.trim();
                  update.mutate({ ...form, name: form.name?.trim() || fallbackName || product.name });
                }}
                disabled={update.isPending}
              >
                {update.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Save className="h-4 w-4 me-1" />}
                {t("save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          {/* Image gallery — spans 5 cols on large screens */}
          <Card className="lg:col-span-5 shadow-card overflow-hidden self-start">
            <CardContent className="p-0">
              {gallery.length > 0 ? (
                <div className="relative aspect-[4/3] bg-muted">
                  <button
                    type="button"
                    onClick={() => setViewer({ paths: gallery, index: 0 })}
                    className="h-full w-full"
                  >
                    <ProductImage path={gallery[0]} className="h-full w-full object-cover" />
                  </button>
                  {gallery.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {gallery.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setViewer({ paths: gallery, index: i }); }}
                          className={`h-2 w-2 rounded-full transition-colors ${i === 0 ? "bg-white" : "bg-white/60 hover:bg-white/80"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-[4/3] flex flex-col items-center justify-center bg-muted text-muted-foreground gap-2">
                  <ImageIcon className="h-14 w-14" />
                  <span className="text-sm">Aucune image</span>
                </div>
              )}
              {gallery.length > 1 && (
                <div className="grid grid-cols-5 gap-2 p-3">
                  {gallery.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setViewer({ paths: gallery, index: i })}
                      className="aspect-square rounded-md overflow-hidden border hover:ring-2 ring-primary"
                    >
                      <ProductImage path={p} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key info cards — spans 7 cols */}
          <div className="lg:col-span-7 grid grid-cols-1 gap-5">
            {/* Financial summary */}
            <Card className="shadow-card bg-gradient-subtle">
              <CardContent className="p-5">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <PriceBlock label="Prix d'achat (TTC)" value={product.purchase_price} />
                </div>
              </CardContent>
            </Card>

            {/* Stock & warehouse */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Card className="shadow-card">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className={`grid h-11 w-11 place-items-center rounded-xl shrink-0 ${out ? "bg-destructive/10 text-destructive" : low ? "bg-warning/20 text-warning-foreground dark:bg-warning/10 dark:text-warning" : "bg-success/10 text-success"}`}>
                    <Boxes className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stock</p>
                    <p className="text-2xl font-display font-semibold tracking-tight mt-0.5">
                      {product.stock_quantity}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Seuil min. {product.min_stock}
                    </p>
                    <Badge
                      variant="outline"
                      className={`mt-2 ${out
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : low
                          ? "bg-warning/20 text-warning-foreground border-warning/40 dark:bg-warning/10 dark:text-warning"
                          : "bg-success/10 text-success border-success/20"}`}
                    >
                      {out ? "Rupture de stock" : low ? "Stock faible" : "En stock"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                    <Warehouse className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dépôt</p>
                    <p className="text-lg font-display font-semibold tracking-tight mt-0.5 truncate">
                      {warehouse?.name || "—"}
                    </p>
                    {warehouse?.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{warehouse.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Specs bento */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SpecTile icon={Tag} label="Marque" value={product.brand || "—"} />
              <SpecTile icon={Barcode} label="Référence" value={product.reference} />
              <SpecTile icon={Ruler} label="Dimensions" value={product.dimensions || "—"} />
            </div>

            {/* Description */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {product.description || "Aucune description."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {viewer && (
        <ImageViewer
          paths={viewer.paths}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

function PriceBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-display font-semibold tracking-tight">
        {value.toFixed(2)} {CURRENCY}
      </p>
    </div>
  );
}

function SpecTile({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: React.ReactNode }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4 flex flex-col items-start gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-sm font-medium truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: React.ReactNode }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <div className="text-sm font-medium truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
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

function ProductImage({ path, className }: { path: string; className?: string }) {
  const { data: url } = useSignedUrl(path);
  if (!url) return <div className={`bg-muted animate-pulse ${className}`} />;
  return <img src={url} alt="" className={className} />;
}

function ImageViewer({ paths, startIndex, onClose }: { paths: string[]; startIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  const currentPath = paths[index];
  const { data: url } = useSignedUrl(currentPath);

  function prev() { setIndex((i) => (i > 0 ? i - 1 : paths.length - 1)); }
  function next() { setIndex((i) => (i < paths.length - 1 ? i + 1 : 0)); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="h-6 w-6" />
      </button>
      {paths.length > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>
        </>
      )}
      <div className="flex max-h-[85vh] max-w-[90vw] items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {url ? <img src={url} alt="" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" /> : <div className="h-64 w-64 rounded-lg bg-white/10 animate-pulse" />}
      </div>
      {paths.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {paths.map((_, i) => (
            <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setIndex(i); }} className={`h-2 w-2 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/40 hover:bg-white/60"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
