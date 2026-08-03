import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, CheckCircle2, Circle, Upload, FileText, ImageIcon, Pencil } from "lucide-react";
import { toast } from "@/lib/notify";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/projects/$id")({
  component: ProjectDetail,
});

const STAGE_LABELS: Record<string, string> = {
  design: "Conception",
  client_validation: "Validation client",
  supplier_order: "Commande fournisseur",
  goods_reception: "Réception marchandises",
  preparation: "Préparation",
  delivery: "Livraison",
  installation: "Installation",
  quality_check: "Contrôle qualité",
  completed: "Projet terminé",
};

const STATUS = {
  active: { label: "En cours", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  on_hold: { label: "En pause", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  completed: { label: "Terminé", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelled: { label: "Annulé", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
} as const;
type Status = keyof typeof STATUS;

type Stage = {
  id: string; stage_key: string; order_index: number;
  planned_date: string | null; actual_date: string | null;
  responsible_id: string | null; comment: string | null; completed: boolean;
};

type Attachment = {
  id: string; project_id: string; stage_key: string | null;
  file_url: string; file_name: string | null; kind: string; created_at: string;
};

type Activity = { id: string; action: string; details: unknown; created_at: string };

function ProjectDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", customer_id: "", start_date: "", expected_end_date: "", budget: 0, install_address: "", notes: "",
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data: proj, error: e1 } = await supabase.from("projects").select("*, customers(name)").eq("id", id).single();
      if (e1) throw e1;
      const { data: stages } = await supabase.from("project_stages").select("*").eq("project_id", id).order("order_index");
      const { data: attach } = await supabase.from("project_attachments").select("*").eq("project_id", id).order("created_at", { ascending: false });
      const { data: act } = await supabase.from("project_activity").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(50);
      return { proj, stages: (stages ?? []) as Stage[], attach: (attach ?? []) as Attachment[], act: (act ?? []) as Activity[] };
    },
  });

  const updateStage = useMutation({
    mutationFn: async (s: { id: string; completed?: boolean; comment?: string | null; planned_date?: string | null; actual_date?: string | null }) => {
      const { id: sid, ...patch } = s;
      const { error } = await supabase.from("project_stages").update(patch).eq("id", sid);
      if (error) throw error;
      await supabase.from("project_activity").insert({
        project_id: id, user_id: user?.id ?? null,
        action: "stage_update",
        details: { stage: sid, patch } as unknown as never,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProject = useMutation({
    mutationFn: async (patch: Partial<typeof form>) => {
      const { error } = await supabase.from("projects").update(patch).eq("id", id);
      if (error) throw error;
      await supabase.from("project_activity").insert({
        project_id: id, user_id: user?.id ?? null,
        action: "project_updated",
        details: { patch } as any,
      });
    },
    onSuccess: () => {
      toast.success("Projet mis à jour");
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: Status) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id);
      if (error) throw error;
      await supabase.from("project_activity").insert({
        project_id: id, user_id: user?.id ?? null, action: "status_changed", details: { status } as any,
      });
    },
    onSuccess: () => { toast.success("Statut mis à jour"); qc.invalidateQueries({ queryKey: ["project", id] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadFile = async (file: File, stage_key: string | null, kind: "document" | "photo") => {
    const path = `projects/${id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
    if (upErr) { toast.error(upErr.message); return; }
    const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60 * 24 * 365);
    const { error } = await supabase.from("project_attachments").insert({
      project_id: id, stage_key: stage_key as never, kind,
      file_url: signed?.signedUrl ?? path, file_name: file.name, uploaded_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("project_activity").insert({
      project_id: id, user_id: user?.id ?? null, action: "attachment_added", details: { file: file.name, stage_key, kind },
    });
    toast.success("Fichier ajouté");
    qc.invalidateQueries({ queryKey: ["project", id] });
  };

  if (isLoading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.proj) return <div className="text-center py-20 text-muted-foreground">Projet introuvable</div>;

  const { proj, stages, attach, act } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/projects"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{proj.name}</h1>
            <p className="text-sm text-muted-foreground">{proj.customers?.name ?? "—"} · {proj.install_address ?? "Adresse non renseignée"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={proj.status} onValueChange={(v) => updateStatus.mutate(v as Status)}>
            <SelectTrigger className={`w-36 h-9 font-medium ${STATUS[proj.status as Status]?.className || ""}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS) as Status[]).map(k => (
                <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => setForm({
                name: proj.name, customer_id: proj.customer_id || "", start_date: proj.start_date || "",
                expected_end_date: proj.expected_end_date || "", budget: proj.budget, install_address: proj.install_address || "", notes: proj.notes || "",
              })}>
                <Pencil className="me-2 h-4 w-4" /> Éditer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Éditer le projet</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nom du projet *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Client</Label>
                  <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                    <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Budget (DH)</Label><Input type="number" value={form.budget} onChange={e = step="any"> setForm({ ...form, budget: Number(e.target.value) })} /></div>
                <div><Label>Date de début</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>Date de fin prévue</Label><Input type="date" value={form.expected_end_date} onChange={e => setForm({ ...form, expected_end_date: e.target.value })} /></div>
                <div className="col-span-2"><Label>Adresse d'installation</Label><Input value={form.install_address} onChange={e => setForm({ ...form, install_address: e.target.value })} /></div>
                <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
                <Button onClick={() => updateProject.mutate(form)} disabled={updateProject.isPending}>
                  {updateProject.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />} Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 grid gap-4 md:grid-cols-4">
          <Info label="Début" value={proj.start_date ?? "—"} />
          <Info label="Fin prévue" value={proj.expected_end_date ?? "—"} />
          <Info label="Budget" value={`${Number(proj.budget).toLocaleString("fr-FR")} DH`} />
          <div>
            <p className="text-xs uppercase text-muted-foreground mb-2">Progression</p>
            <div className="flex items-center gap-2">
              <Progress value={proj.progress} className="h-2" />
              <span className="text-xs tabular-nums">{proj.progress}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Étapes</TabsTrigger>
          <TabsTrigger value="attachments">Documents & Photos</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-3">
          {stages.map(s => (
            <Card key={s.id} className={s.completed ? "border-emerald-500/30" : ""}>
              <CardContent className="p-4 grid gap-3 md:grid-cols-[auto_1fr_auto_auto_auto] items-start">
                <button
                  onClick={() => updateStage.mutate({
                    id: s.id, completed: !s.completed,
                    actual_date: !s.completed ? new Date().toISOString().slice(0, 10) : null,
                  })}
                  className="mt-1"
                  title={s.completed ? "Décocher" : "Marquer terminé"}
                >
                  {s.completed ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
                </button>
                <div>
                  <p className="font-medium">{STAGE_LABELS[s.stage_key] ?? s.stage_key}</p>
                  <Textarea
                    className="mt-1 min-h-[32px] text-sm"
                    placeholder="Commentaire…"
                    defaultValue={s.comment ?? ""}
                    onBlur={e => { if (e.target.value !== (s.comment ?? "")) updateStage.mutate({ id: s.id, comment: e.target.value }); }}
                  />
                </div>
                <div className="text-xs">
                  <p className="text-muted-foreground mb-1">Prévu</p>
                  <Input type="date" className="h-8 w-40" defaultValue={s.planned_date ?? ""}
                    onBlur={e => { if (e.target.value !== (s.planned_date ?? "")) updateStage.mutate({ id: s.id, planned_date: e.target.value || null }); }} />
                </div>
                <div className="text-xs">
                  <p className="text-muted-foreground mb-1">Réel</p>
                  <Input type="date" className="h-8 w-40" defaultValue={s.actual_date ?? ""}
                    onBlur={e => { if (e.target.value !== (s.actual_date ?? "")) updateStage.mutate({ id: s.id, actual_date: e.target.value || null }); }} />
                </div>
                <div>
                  <label className="cursor-pointer">
                    <input type="file" hidden onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, s.stage_key, f.type.startsWith("image/") ? "photo" : "document"); }} />
                    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"><Upload className="h-3 w-3" /> Joindre</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="attachments">
          <Card>
            <CardContent className="p-4">
              <label className="cursor-pointer mb-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                <input type="file" hidden onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, null, f.type.startsWith("image/") ? "photo" : "document"); }} />
                <Upload className="h-4 w-4" /> Ajouter un fichier
              </label>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {attach.length === 0 ? <p className="text-sm text-muted-foreground col-span-full">Aucun document</p> :
                  attach.map(a => (
                    <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 rounded-md border p-3 hover:bg-accent">
                      {a.kind === "photo" ? <ImageIcon className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.file_name ?? "Fichier"}</p>
                        <p className="text-xs text-muted-foreground">{a.stage_key ? STAGE_LABELS[a.stage_key] : "Général"} · {new Date(a.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                    </a>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-4 space-y-2">
              {act.length === 0 ? <p className="text-sm text-muted-foreground">Aucune activité</p> :
                act.map(a => (
                  <div key={a.id} className="flex items-start gap-3 border-b py-2 text-sm last:border-0">
                    <Badge variant="outline" className="mt-0.5">{a.action}</Badge>
                    <div className="flex-1">
                      <p className="text-muted-foreground text-xs">{new Date(a.created_at).toLocaleString("fr-FR")}</p>
                      <pre className="text-xs mt-1 whitespace-pre-wrap">{JSON.stringify(a.details, null, 2)}</pre>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
