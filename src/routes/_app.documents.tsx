import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  Upload, Search, Trash2, Download, Eye, FileText, FileSpreadsheet, FileImage,
  File as FileIcon, History, Loader2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/documents")({
  component: DocumentsPage,
});

type Category = "factures" | "devis" | "contrats" | "projets_cuisines" | "sav" | "photos" | "autres";

type Doc = {
  id: string;
  name: string;
  category: Category;
  customer_id: string | null;
  file_path: string;
  file_type: string | null;
  file_size: number;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: "factures", label: "Factures", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  { value: "devis", label: "Devis", color: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" },
  { value: "contrats", label: "Contrats", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  { value: "projets_cuisines", label: "Projets cuisines", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  { value: "sav", label: "SAV", color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
  { value: "photos", label: "Photos", color: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30" },
  { value: "autres", label: "Autres", color: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30" },
];
const catMeta = (c: Category) => CATEGORIES.find((x) => x.value === c)!;

const formatSize = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

const fileIcon = (type: string | null) => {
  if (!type) return FileIcon;
  if (type.startsWith("image/")) return FileImage;
  if (type.includes("pdf")) return FileText;
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return FileSpreadsheet;
  if (type.includes("word") || type.includes("document")) return FileText;
  return FileIcon;
};

function DocumentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [customer, setCustomer] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [historyDoc, setHistoryDoc] = useState<Doc | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Doc | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [upFile, setUpFile] = useState<File | null>(null);
  const [upName, setUpName] = useState("");
  const [upCat, setUpCat] = useState<Category>("autres");
  const [upCustomer, setUpCustomer] = useState<string>("");
  const [upDesc, setUpDesc] = useState("");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["doc-history", historyDoc?.id],
    enabled: !!historyDoc,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_history").select("*")
        .eq("document_id", historyDoc!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; action: string; details: any; created_at: string }>;
    },
  });

  const customerName = (id: string | null) =>
    id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (cat !== "all" && d.category !== cat) return false;
      if (customer !== "all" && d.customer_id !== customer) return false;
      if (s && !d.name.toLowerCase().includes(s) && !(d.description ?? "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [docs, search, cat, customer]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      total: docs.length,
      month: docs.filter((d) => new Date(d.created_at) >= monthStart).length,
      factures: docs.filter((d) => d.category === "factures").length,
      contrats: docs.filter((d) => d.category === "contrats").length,
    };
  }, [docs]);

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!upFile) throw new Error("Aucun fichier sélectionné");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const ext = upFile.name.split(".").pop() ?? "bin";
      const path = `${uid ?? "anon"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, upFile, {
        contentType: upFile.type || undefined,
      });
      if (upErr) throw upErr;
      const { data, error } = await supabase.from("documents").insert({
        name: upName || upFile.name,
        category: upCat,
        customer_id: upCustomer || null,
        file_path: path,
        file_type: upFile.type || null,
        file_size: upFile.size,
        description: upDesc || null,
        created_by: uid ?? null,
      }).select().single();
      if (error) throw error;
      await supabase.from("document_history").insert({
        document_id: data.id, action: "created",
        details: { name: data.name, category: data.category }, user_id: uid ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Document ajouté");
      setUploadOpen(false);
      setUpFile(null); setUpName(""); setUpCat("autres"); setUpCustomer(""); setUpDesc("");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur upload"),
  });

  const deleteMut = useMutation({
    mutationFn: async (doc: Doc) => {
      await supabase.storage.from("documents").remove([doc.file_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document supprimé");
      setDeleteDoc(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const signedUrl = async (path: string, download?: string) => {
    const { data, error } = await supabase.storage.from("documents")
      .createSignedUrl(path, 60 * 5, download ? { download } : undefined);
    if (error) throw error;
    return data.signedUrl;
  };

  const handleDownload = async (d: Doc) => {
    try {
      const url = await signedUrl(d.file_path, d.name);
      window.open(url, "_blank");
      await supabase.from("document_history").insert({
        document_id: d.id, action: "downloaded", details: null,
        user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
      });
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePreview = async (d: Doc) => {
    try {
      const url = await signedUrl(d.file_path);
      setPreviewUrl(url); setPreviewDoc(d);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Gestion documentaire : factures, devis, contrats, projets…</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" /> Importer un document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total documents", value: stats.total, icon: FileIcon },
          { label: "Ce mois-ci", value: stats.month, icon: Upload },
          { label: "Factures", value: stats.factures, icon: FileText },
          { label: "Contrats", value: stats.contrats, icon: FileText },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold">{s.value}</p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <s.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un document..." className="pl-9" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les clients</SelectItem>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom du document</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date d'ajout</TableHead>
              <TableHead>Taille</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                Aucun document</TableCell></TableRow>
            )}
            {filtered.map((d) => {
              const Icon = fileIcon(d.file_type);
              const m = catMeta(d.category);
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{d.name}</div>
                        {d.description && <div className="text-xs text-muted-foreground line-clamp-1">{d.description}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={m.color}>{m.label}</Badge></TableCell>
                  <TableCell className="text-sm">{customerName(d.customer_id)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-sm">{formatSize(d.file_size)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Aperçu" onClick={() => handlePreview(d)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Télécharger" onClick={() => handleDownload(d)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Historique" onClick={() => setHistoryDoc(d)}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Supprimer" onClick={() => setDeleteDoc(d)}>
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

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Importer un document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fichier (PDF, Word, Excel, Image)</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setUpFile(f);
                  if (f && !upName) setUpName(f.name);
                }}
              />
              {upFile && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {upFile.name} — {formatSize(upFile.size)}
                </p>
              )}
            </div>
            <div>
              <Label>Nom du document</Label>
              <Input value={upName} onChange={(e) => setUpName(e.target.value)} placeholder="Nom affiché" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Catégorie</Label>
                <Select value={upCat} onValueChange={(v) => setUpCat(v as Category)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Client (optionnel)</Label>
                <Select value={upCustomer || "none"} onValueChange={(v) => setUpCustomer(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={upDesc} onChange={(e) => setUpDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Annuler</Button>
            <Button onClick={() => uploadMut.mutate()} disabled={!upFile || uploadMut.isPending}>
              {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => { if (!o) { setPreviewDoc(null); setPreviewUrl(""); } }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2">
            {previewDoc?.name}
          </DialogTitle></DialogHeader>
          <div className="h-[70vh] w-full overflow-auto rounded-md border bg-muted/30">
            {previewDoc && previewUrl && (
              previewDoc.file_type?.startsWith("image/") ? (
                <img src={previewUrl} alt={previewDoc.name} className="mx-auto max-h-full" />
              ) : (
                <iframe src={previewUrl} title={previewDoc.name} className="h-full w-full" />
              )
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => previewDoc && handleDownload(previewDoc)} className="gap-2">
              <Download className="h-4 w-4" /> Télécharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyDoc} onOpenChange={(o) => { if (!o) setHistoryDoc(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Historique — {historyDoc?.name}</DialogTitle></DialogHeader>
          <div className="max-h-96 space-y-2 overflow-auto">
            {history.length === 0 && <p className="text-sm text-muted-foreground">Aucun historique</p>}
            {history.map((h) => (
              <div key={h.id} className="flex items-start justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium capitalize">{h.action}</div>
                  {h.details && <pre className="mt-1 text-xs text-muted-foreground">{JSON.stringify(h.details)}</pre>}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("fr-FR")}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => { if (!o) setDeleteDoc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDoc?.name}" sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDoc && deleteMut.mutate(deleteDoc)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
