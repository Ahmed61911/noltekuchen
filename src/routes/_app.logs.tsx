import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, History as HistoryIcon, Activity, Users as UsersIcon, Plus, Pencil,
  Trash2, LogIn, LogOut, Download, CheckCircle2, Eye, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/logs")({
  component: LogsPage,
});

type Log = {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

const ACTION_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; badge: string }> = {
  create:   { label: "Création",     icon: Plus,         badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  update:   { label: "Modification", icon: Pencil,       badge: "bg-blue-100 text-blue-700 border-blue-200" },
  delete:   { label: "Suppression",  icon: Trash2,       badge: "bg-red-100 text-red-700 border-red-200" },
  login:    { label: "Connexion",    icon: LogIn,        badge: "bg-teal-100 text-teal-700 border-teal-200" },
  logout:   { label: "Déconnexion",  icon: LogOut,       badge: "bg-slate-100 text-slate-700 border-slate-200" },
  export:   { label: "Export",       icon: Download,     badge: "bg-purple-100 text-purple-700 border-purple-200" },
  validate: { label: "Validation",   icon: CheckCircle2, badge: "bg-amber-100 text-amber-700 border-amber-200" },
  view:     { label: "Consultation", icon: Eye,          badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

const MODULE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#ec4899", "#64748b", "#06b6d4", "#84cc16"];

function LogsPage() {
  const { data: logs = [] } = useQuery({
    queryKey: ["logs_all"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000);
      return (data ?? []) as Log[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_brief"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data ?? [];
    },
  });
  const profileMap = useMemo(() => new Map(profiles.map((p: { id: string; full_name: string | null }) => [p.id, p.full_name])), [profiles]);

  const [search, setSearch] = useState("");
  const [userF, setUserF] = useState("all");
  const [moduleF, setModuleF] = useState("all");
  const [actionF, setActionF] = useState("all");
  const [periodF, setPeriodF] = useState("all");
  const [detail, setDetail] = useState<Log | null>(null);

  const modules = useMemo(() => Array.from(new Set(logs.map((l) => l.module))).sort(), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);
  const users = useMemo(() => {
    const ids = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean) as string[]));
    return ids.map((id) => ({ id, name: profileMap.get(id) || id.slice(0, 8) }));
  }, [logs, profileMap]);

  const filtered = useMemo(() => logs.filter((l) => {
    if (userF !== "all" && l.user_id !== userF) return false;
    if (moduleF !== "all" && l.module !== moduleF) return false;
    if (actionF !== "all" && l.action !== actionF) return false;
    if (periodF !== "all") {
      const d = new Date(l.created_at);
      const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      if (periodF === "today" && diff > 1) return false;
      if (periodF === "7d" && diff > 7) return false;
      if (periodF === "30d" && diff > 30) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      const name = (profileMap.get(l.user_id ?? "") || "").toLowerCase();
      const desc = String((l.new_value as { description?: string } | null)?.description ?? "").toLowerCase();
      if (!l.action.toLowerCase().includes(s) && !name.includes(s) && !l.module.toLowerCase().includes(s) && !desc.includes(s)) return false;
    }
    return true;
  }), [logs, search, userF, moduleF, actionF, periodF, profileMap]);

  const todayCount = logs.filter((l) => (Date.now() - new Date(l.created_at).getTime()) < 24 * 3600 * 1000).length;
  const activeUsers = new Set(logs.filter((l) => (Date.now() - new Date(l.created_at).getTime()) < 24 * 3600 * 1000).map((l) => l.user_id)).size;
  const createsCount = logs.filter((l) => l.action === "create").length;
  const updatesCount = logs.filter((l) => l.action === "update").length;

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    logs.forEach((l) => {
      const k = l.created_at.slice(0, 10);
      if (map.has(k)) map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).map(([date, count]) => ({ date: date.slice(5), count }));
  }, [logs]);

  const byUser = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => {
      const name = profileMap.get(l.user_id ?? "") || "Inconnu";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [logs, profileMap]);

  const byModule = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => map.set(l.module, (map.get(l.module) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <HistoryIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Journal d'actions</h1>
          <p className="text-sm text-muted-foreground">Historique complet de toutes les actions effectuées dans l'ERP</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Activity} label="Actions aujourd'hui" value={todayCount} color="text-blue-600" bg="bg-blue-100" />
        <StatCard icon={UsersIcon} label="Utilisateurs actifs" value={activeUsers} color="text-emerald-600" bg="bg-emerald-100" />
        <StatCard icon={Plus} label="Créations" value={createsCount} color="text-green-600" bg="bg-green-100" />
        <StatCard icon={Pencil} label="Modifications" value={updatesCount} color="text-amber-600" bg="bg-amber-100" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Actions par jour (14 derniers jours)</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Actions par module</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byModule} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(d: { name: string }) => d.name}>
                  {byModule.map((_, i) => <Cell key={i} fill={MODULE_COLORS[i % MODULE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-card lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Actions par utilisateur (top 8)</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byUser}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Actions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher action, utilisateur, description..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={userF} onValueChange={setUserF}>
            <SelectTrigger className="w-[180px]"><Filter className="me-1 h-3.5 w-3.5" /><SelectValue placeholder="Utilisateur" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous utilisateurs</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={moduleF} onValueChange={setModuleF}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous modules</SelectItem>
              {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actionF} onValueChange={setActionF}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes actions</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{ACTION_META[a]?.label ?? a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={periodF} onValueChange={setPeriodF}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Période" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute période</SelectItem>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="7d">7 derniers jours</SelectItem>
              <SelectItem value="30d">30 derniers jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setUserF("all"); setModuleF("all"); setActionF("all"); setPeriodF("all"); }}>
            Réinitialiser
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Heure</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="text-right">Détail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Aucune action enregistrée</TableCell></TableRow>
              ) : filtered.map((l) => {
                const meta = ACTION_META[l.action] ?? ACTION_META.view;
                const Icon = meta.icon;
                const desc = (l.new_value as { description?: string } | null)?.description ?? "—";
                return (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => setDetail(l)}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-sm">{profileMap.get(l.user_id ?? "") || "—"}</TableCell>
                    <TableCell className="capitalize text-sm">{l.module}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={meta.badge}>
                        <Icon className="me-1 h-3 w-3" /> {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[280px] truncate">{desc}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{l.ip_address ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDetail(l); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Détail de l'action</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="Date" value={new Date(detail.created_at).toLocaleString("fr-FR")} />
                <DetailRow label="Utilisateur" value={profileMap.get(detail.user_id ?? "") || "—"} />
                <DetailRow label="Module" value={detail.module} />
                <DetailRow label="Action" value={ACTION_META[detail.action]?.label ?? detail.action} />
                <DetailRow label="Entité" value={detail.entity_id ?? "—"} mono />
                <DetailRow label="Adresse IP" value={detail.ip_address ?? "—"} mono />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">User Agent</p>
                <p className="text-xs font-mono bg-muted/40 rounded p-2 break-all">{detail.user_agent ?? "—"}</p>
              </div>
              {detail.old_value && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Ancienne valeur</p>
                  <pre className="text-xs font-mono bg-red-50 border border-red-200 rounded p-2 overflow-auto max-h-[200px]">{JSON.stringify(detail.old_value, null, 2)}</pre>
                </div>
              )}
              {detail.new_value && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Nouvelle valeur</p>
                  <pre className="text-xs font-mono bg-emerald-50 border border-emerald-200 rounded p-2 overflow-auto max-h-[200px]">{JSON.stringify(detail.new_value, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string; bg: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-12 w-12 place-items-center rounded-xl ${bg} ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
