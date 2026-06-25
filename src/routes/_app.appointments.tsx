import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, Search, Loader2, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Clock, MapPin, User, CheckCircle2, AlertCircle, PlayCircle, XCircle,
} from "lucide-react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/appointments")({
  component: AppointmentsPage,
});

type Status = "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled";

type Appointment = {
  id: string;
  title: string;
  description: string | null;
  customer_id: string | null;
  assigned_to: string | null;
  start_at: string;
  end_at: string;
  location: string | null;
  status: Status;
  notes: string | null;
  reminder_minutes: number | null;
  reminder_sent: boolean;
};

type FormState = Omit<Appointment, "id" | "reminder_sent">;

const STATUSES: { value: Status; label: string; color: string; icon: typeof CheckCircle2 }[] = [
  { value: "scheduled", label: "Planifié", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30", icon: CalendarIcon },
  { value: "confirmed", label: "Confirmé", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  { value: "in_progress", label: "En cours", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", icon: PlayCircle },
  { value: "completed", label: "Terminé", color: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30", icon: CheckCircle2 },
  { value: "cancelled", label: "Annulé", color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30", icon: XCircle },
];
const statusMeta = (s: Status) => STATUSES.find(x => x.value === s)!;

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const nowPlus = (mins: number) => {
  const d = new Date(Date.now() + mins * 60_000);
  return toLocalInput(d.toISOString());
};

const emptyForm = (): FormState => ({
  title: "",
  description: "",
  customer_id: null,
  assigned_to: null,
  start_at: new Date(nowPlus(60)).toISOString(),
  end_at: new Date(nowPlus(120)).toISOString(),
  location: "",
  status: "scheduled",
  notes: "",
  reminder_minutes: 30,
});

function AppointmentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [view, setView] = useState<"month" | "week" | "day" | "list">("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [details, setDetails] = useState<Appointment | null>(null);
  const [confirmDel, setConfirmDel] = useState<Appointment | null>(null);


  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("start_at", { ascending: true });
      if (error) throw error;
      return data as Appointment[];
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

  const { data: users = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name").order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string | null }[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: FormState & { id?: string }) => {
      const { id, ...payload } = p;
      const clean = {
        ...payload,
        customer_id: payload.customer_id || null,
        assigned_to: payload.assigned_to || null,
        description: payload.description || null,
        location: payload.location || null,
        notes: payload.notes || null,
      };
      if (id) {
        const { error } = await supabase.from("appointments").update(clean).eq("id", id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("appointments").insert({ ...clean, created_by: u.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Rendez-vous enregistré");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setOpen(false); setEditing(null); setForm(emptyForm());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  // Filters
  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return appointments.filter(a => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (customerFilter !== "all" && a.customer_id !== customerFilter) return false;
      if (!term) return true;
      const c = customers.find(x => x.id === a.customer_id)?.name ?? "";
      return (
        a.title.toLowerCase().includes(term) ||
        (a.location ?? "").toLowerCase().includes(term) ||
        c.toLowerCase().includes(term)
      );
    });
  }, [appointments, q, statusFilter, customerFilter, customers]);

  // KPIs
  const stats = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday); endToday.setDate(endToday.getDate() + 1);
    const startWeek = new Date(startToday); startWeek.setDate(startToday.getDate() - ((startToday.getDay() + 6) % 7));
    const endWeek = new Date(startWeek); endWeek.setDate(startWeek.getDate() + 7);
    const today = appointments.filter(a => new Date(a.start_at) >= startToday && new Date(a.start_at) < endToday);
    const week = appointments.filter(a => new Date(a.start_at) >= startWeek && new Date(a.start_at) < endWeek);
    const completed = appointments.filter(a => a.status === "completed");
    const pending = appointments.filter(a => a.status === "scheduled" || a.status === "confirmed");
    return { today: today.length, week: week.length, completed: completed.length, pending: pending.length };
  }, [appointments]);

  // Local reminder notifications
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const fired = new Set<string>();
    const tick = () => {
      const now = Date.now();
      appointments.forEach(a => {
        if (a.status === "cancelled" || a.status === "completed") return;
        const mins = a.reminder_minutes ?? 0;
        const start = new Date(a.start_at).getTime();
        const remindAt = start - mins * 60_000;
        const key = `${a.id}:${start}`;
        if (now >= remindAt && now < start && !fired.has(key)) {
          fired.add(key);
          const msg = `${a.title} à ${new Date(a.start_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
          toast.message("Rappel rendez-vous", { description: msg });
          if ("Notification" in window && Notification.permission === "granted") {
            try { new Notification("Rappel rendez-vous", { body: msg }); } catch { /* noop */ }
          }
        }
      });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [appointments]);

  const openCreate = (preset?: Partial<FormState>) => {
    setEditing(null);
    setForm({ ...emptyForm(), ...preset });
    setOpen(true);
  };
  const openEdit = (a: Appointment) => {
    setEditing(a);
    setForm({
      title: a.title, description: a.description, customer_id: a.customer_id, assigned_to: a.assigned_to,
      start_at: a.start_at, end_at: a.end_at, location: a.location, status: a.status, notes: a.notes,
      reminder_minutes: a.reminder_minutes,
    });
    setOpen(true);
  };

  const customerName = (id: string | null) => customers.find(c => c.id === id)?.name ?? "—";
  const userName = (id: string | null) => users.find(u => u.id === id)?.full_name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Rendez-vous</h1>
          <p className="text-sm text-muted-foreground">Planification et suivi des rendez-vous clients</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm()); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => openCreate()}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau rendez-vous
            </Button>
          </DialogTrigger>
          <AppointmentDialog
            editing={editing}
            form={form}
            setForm={setForm}
            customers={customers}
            users={users}
            onSave={() => upsert.mutate({ ...form, id: editing?.id })}
            saving={upsert.isPending}
            onCancel={() => setOpen(false)}
          />
        </Dialog>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={CalendarIcon} label="Aujourd'hui" value={stats.today} accent="text-blue-600" />
        <KpiCard icon={Clock} label="Cette semaine" value={stats.week} accent="text-amber-600" />
        <KpiCard icon={CheckCircle2} label="Terminés" value={stats.completed} accent="text-emerald-600" />
        <KpiCard icon={AlertCircle} label="En attente" value={stats.pending} accent="text-violet-600" />
      </div>

      {/* Tabs view switcher */}
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="month">Mois</TabsTrigger>
            <TabsTrigger value="week">Semaine</TabsTrigger>
            <TabsTrigger value="day">Jour</TabsTrigger>
            <TabsTrigger value="list">Liste</TabsTrigger>
          </TabsList>
          {view !== "list" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCursor(shift(cursor, view, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCursor(new Date())}>Aujourd'hui</Button>
              <Button variant="outline" size="icon" onClick={() => setCursor(shift(cursor, view, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="ml-2 text-sm font-medium text-muted-foreground">{labelForCursor(cursor, view)}</div>
            </div>
          )}
        </div>

        <TabsContent value="month" className="mt-4">
          <MonthView cursor={cursor} appointments={appointments} onPick={(d) => openCreate({ start_at: d.toISOString(), end_at: new Date(d.getTime() + 60 * 60_000).toISOString() })} onClick={openEdit} />
        </TabsContent>
        <TabsContent value="week" className="mt-4">
          <WeekView cursor={cursor} appointments={appointments} onClick={openEdit} />
        </TabsContent>
        <TabsContent value="day" className="mt-4">
          <DayView cursor={cursor} appointments={appointments} onClick={openEdit} />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card className="p-4">
            <div className="mb-3 grid gap-2 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Rechercher (titre, lieu, client)…" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous clients</SelectItem>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Commercial</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Chargement…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Aucun rendez-vous</TableCell></TableRow>
                ) : filtered.map(a => {
                  const m = statusMeta(a.status);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <div>{a.title}</div>
                        {a.location && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</div>}
                      </TableCell>
                      <TableCell>{customerName(a.customer_id)}</TableCell>
                      <TableCell>{userName(a.assigned_to)}</TableCell>
                      <TableCell>{fmtDateTime(a.start_at)}</TableCell>
                      <TableCell>{fmtDateTime(a.end_at)}</TableCell>
                      <TableCell>
                        <Select value={a.status} onValueChange={(v) => setStatus.mutate({ id: a.id, status: v as Status })}>
                          <SelectTrigger className={cn("h-8 w-[140px] border", m.color)}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer ce rendez-vous ?")) remove.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: typeof CheckCircle2; label: string; value: number; accent: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className={cn("grid h-10 w-10 place-items-center rounded-xl bg-accent", accent)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function AppointmentDialog({
  editing, form, setForm, customers, users, onSave, saving, onCancel,
}: {
  editing: Appointment | null;
  form: FormState;
  setForm: (f: FormState) => void;
  customers: { id: string; name: string }[];
  users: { id: string; full_name: string | null }[];
  onSave: () => void;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editing ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Titre *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>

        <div><Label>Client</Label>
          <Select value={form.customer_id ?? "none"} onValueChange={(v) => setForm({ ...form, customer_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Aucun —</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div><Label>Commercial assigné</Label>
          <Select value={form.assigned_to ?? "none"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Non assigné —</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.id.slice(0, 8)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div><Label>Début *</Label>
          <Input type="datetime-local" value={toLocalInput(form.start_at)} onChange={e => setForm({ ...form, start_at: new Date(e.target.value).toISOString() })} />
        </div>
        <div><Label>Fin *</Label>
          <Input type="datetime-local" value={toLocalInput(form.end_at)} onChange={e => setForm({ ...form, end_at: new Date(e.target.value).toISOString() })} />
        </div>

        <div><Label>Lieu</Label><Input value={form.location ?? ""} onChange={e => setForm({ ...form, location: e.target.value })} /></div>

        <div><Label>Statut</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2"><Label>Description</Label><Textarea value={form.description ?? ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="col-span-2"><Label>Notes / Commentaires</Label><Textarea value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

        <div><Label>Rappel (minutes avant)</Label>
          <Input type="number" min={0} value={form.reminder_minutes ?? 0} onChange={e => setForm({ ...form, reminder_minutes: Number(e.target.value) })} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
        <Button onClick={onSave} disabled={!form.title || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---------- Calendar views ----------

function shift(d: Date, view: "month" | "week" | "day" | "list", dir: number): Date {
  const n = new Date(d);
  if (view === "month") n.setMonth(n.getMonth() + dir);
  else if (view === "week") n.setDate(n.getDate() + 7 * dir);
  else n.setDate(n.getDate() + dir);
  return n;
}
function labelForCursor(d: Date, view: "month" | "week" | "day" | "list") {
  if (view === "month") return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  if (view === "day") return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const start = startOfWeek(d);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
}
function startOfWeek(d: Date) {
  const n = new Date(d); n.setHours(0, 0, 0, 0);
  n.setDate(n.getDate() - ((n.getDay() + 6) % 7));
  return n;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MonthView({ cursor, appointments, onPick, onClick }: { cursor: Date; appointments: Appointment[]; onPick: (d: Date) => void; onClick: (a: Appointment) => void; }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startGrid = startOfWeek(first);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) { const d = new Date(startGrid); d.setDate(startGrid.getDate() + i); days.push(d); }
  const today = new Date();
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(d => <div key={d} className="px-2 py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayAppts = appointments.filter(a => sameDay(new Date(a.start_at), d));
          return (
            <div key={i} className={cn("min-h-[110px] border-b border-r p-1.5 text-xs", !inMonth && "bg-muted/20 text-muted-foreground")}>
              <div className="mb-1 flex items-center justify-between">
                <button onClick={() => onPick(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0))}
                  className={cn("grid h-6 w-6 place-items-center rounded-full text-xs hover:bg-accent",
                    sameDay(d, today) && "bg-primary text-primary-foreground hover:bg-primary")}>
                  {d.getDate()}
                </button>
              </div>
              <div className="space-y-1">
                {dayAppts.slice(0, 3).map(a => {
                  const m = statusMeta(a.status);
                  return (
                    <button key={a.id} onClick={() => onClick(a)} className={cn("block w-full truncate rounded border px-1.5 py-0.5 text-left", m.color)}>
                      {new Date(a.start_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} {a.title}
                    </button>
                  );
                })}
                {dayAppts.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayAppts.length - 3} autres</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekView({ cursor, appointments, onClick }: { cursor: Date; appointments: Appointment[]; onClick: (a: Appointment) => void; }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const today = new Date();
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 divide-x">
        {days.map(d => {
          const list = appointments.filter(a => sameDay(new Date(a.start_at), d)).sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
          return (
            <div key={d.toISOString()} className="min-h-[400px] p-2">
              <div className={cn("mb-2 text-xs font-medium uppercase tracking-wide", sameDay(d, today) ? "text-primary" : "text-muted-foreground")}>
                {d.toLocaleDateString("fr-FR", { weekday: "short" })} {d.getDate()}
              </div>
              <div className="space-y-1.5">
                {list.length === 0 && <div className="text-xs text-muted-foreground">—</div>}
                {list.map(a => {
                  const m = statusMeta(a.status);
                  return (
                    <button key={a.id} onClick={() => onClick(a)} className={cn("block w-full rounded border px-2 py-1.5 text-left text-xs", m.color)}>
                      <div className="font-medium">{a.title}</div>
                      <div className="opacity-80">{new Date(a.start_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – {new Date(a.end_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DayView({ cursor, appointments, onClick }: { cursor: Date; appointments: Appointment[]; onClick: (a: Appointment) => void; }) {
  const list = appointments.filter(a => sameDay(new Date(a.start_at), cursor)).sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
  return (
    <Card className="p-4">
      {list.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Aucun rendez-vous ce jour</div>
      ) : (
        <div className="space-y-2">
          {list.map(a => {
            const m = statusMeta(a.status);
            const Icon = m.icon;
            return (
              <button key={a.id} onClick={() => onClick(a)} className={cn("flex w-full items-start gap-3 rounded-lg border p-3 text-left transition hover:shadow-sm", m.color)}>
                <div className="rounded-md bg-background/60 p-2"><Icon className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{a.title}</div>
                    <Badge variant="outline" className={m.color}>{m.label}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs opacity-90">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(a.start_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – {new Date(a.end_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    {a.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</span>}
                    {a.assigned_to && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{a.assigned_to.slice(0, 8)}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
