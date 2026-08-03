import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Eye, Trash2, Loader2, Kanban, Activity, CheckCircle2, Clock } from "lucide-react";
import { toast } from "@/lib/notify";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { DataPagination, usePagination } from "@/components/data/pagination";

export const Route = createFileRoute("/_app/projects/")({
  component: ProjectsPage,
});

const STATUS = {
  active: { label: "En cours", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  on_hold: { label: "En pause", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  completed: { label: "Terminé", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelled: { label: "Annulé", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
} as const;
type Status = keyof typeof STATUS;

type Project = {
  id: string; name: string; customer_id: string | null;
  start_date: string | null; expected_end_date: string | null;
  budget: number; install_address: string | null;
  status: Status; progress: number; notes: string | null;
  customers: { name: string } | null;
};

const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n)} DH`;

function ProjectsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", customer_id: "", start_date: new Date().toISOString().slice(0, 10),
    expected_end_date: "", budget: 0, install_address: "", notes: "",
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*, customers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Project[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Nom du projet requis");
      const { error } = await supabase.from("projects").insert({
        name: form.name,
        customer_id: form.customer_id || null,
        commercial_id: user?.id ?? null,
        start_date: form.start_date || null,
        expected_end_date: form.expected_end_date || null,
        budget: form.budget,
        install_address: form.install_address || null,
        notes: form.notes || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projet créé"); qc.invalidateQueries({ queryKey: ["projects"] }); setOpen(false);
      setForm({ name: "", customer_id: "", start_date: new Date().toISOString().slice(0, 10), expected_end_date: "", budget: 0, install_address: "", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: Status }) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id);
      if (error) throw error;
      await supabase.from("project_activity").insert({
        project_id: id, user_id: user?.id ?? null,
        action: "status_changed",
        details: { status } as any,
      });
    },
    onSuccess: () => { toast.success("Statut mis à jour"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = projects.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.customers?.name ?? "").toLowerCase().includes(s);
  });

  const pagination = usePagination({
    total: filtered.length,
    resetKey: `${q}-${statusFilter}`,
  });
  const paged = pagination.slice(filtered);

  const kpis = {
    total: projects.length,
    active: projects.filter(p => p.status === "active").length,
    completed: projects.filter(p => p.status === "completed").length,
    avgProgress: projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Projets clients</h1>
          <p className="text-sm text-muted-foreground">Suivi complet de la conception à l'installation</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="me-2 h-4 w-4" /> Nouveau projet</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nouveau projet</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nom du projet *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Client</Label>
                <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Budget (DH)</Label><Input type="number" value={form.budget} step="any" onChange={e => setForm({ ...form, budget: Number(e.target.value) })} /></div>
              <div><Label>Date de début</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Date de fin prévue</Label><Input type="date" value={form.expected_end_date} onChange={e => setForm({ ...form, expected_end_date: e.target.value })} /></div>
              <div className="col-span-2"><Label>Adresse d'installation</Label><Input value={form.install_address} onChange={e => setForm({ ...form, install_address: e.target.value })} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />} Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Kanban} label="Total projets" value={String(kpis.total)} />
        <KpiCard icon={Activity} label="En cours" value={String(kpis.active)} />
        <KpiCard icon={CheckCircle2} label="Terminés" value={String(kpis.completed)} accent="emerald" />
        <KpiCard icon={Clock} label="Progression moy." value={`${kpis.avgProgress}%`} accent="amber" />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="ps-8" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {(Object.keys(STATUS) as Status[]).map(k => <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projet</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin prévue</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="w-[180px]">Progression</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun projet</TableCell></TableRow>
            ) : paged.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.customers?.name ?? "—"}</TableCell>
                <TableCell>{p.start_date ?? "—"}</TableCell>
                <TableCell>{p.expected_end_date ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(p.budget))}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={p.progress} className="h-2" />
                    <span className="text-xs text-muted-foreground tabular-nums w-8">{p.progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Select value={p.status} onValueChange={(v) => updateStatus.mutate({ id: p.id, status: v as Status })}>
                    <SelectTrigger className={`h-8 border-0 shadow-none font-medium ${STATUS[p.status].className}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS) as Status[]).map(k => (
                        <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" asChild>
                    <Link to="/projects/$id" params={{ id: p.id }}><Eye className="h-4 w-4" /></Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={async () => { if (await confirm({ title: `Supprimer le projet ${p.name} ?`, description: "Toutes ses étapes, pièces jointes et activités seront supprimées.", confirmLabel: "Supprimer", destructive: true })) remove.mutate(p.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
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

function KpiCard({ icon: Icon, label, value, accent }: { icon: typeof Kanban; label: string; value: string; accent?: "emerald" | "amber" }) {
  const color = accent === "emerald" ? "text-emerald-600 bg-emerald-500/10"
    : accent === "amber" ? "text-amber-600 bg-amber-500/10"
    : "text-primary bg-primary/10";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
