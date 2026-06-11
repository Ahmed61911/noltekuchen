import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, History as HistoryIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !isAdmin) nav({ to: "/dashboard" }); }, [loading, isAdmin, nav]);

  const { data: logs = [] } = useQuery({
    queryKey: ["audit_all"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_brief"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const profileMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p.full_name])), [profiles]);

  const [search, setSearch] = useState("");
  const [module, setModule] = useState("all");

  const filtered = useMemo(() => logs.filter((l: any) => {
    if (module !== "all" && l.module !== module) return false;
    if (search) {
      const s = search.toLowerCase();
      const name = (profileMap.get(l.user_id) || "").toLowerCase();
      if (!l.action.toLowerCase().includes(s) && !name.includes(s)) return false;
    }
    return true;
  }), [logs, search, module, profileMap]);

  const modules = useMemo(() => Array.from(new Set(logs.map((l: any) => l.module))), [logs]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><HistoryIcon className="h-5 w-5" /></div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Journal d'audit</h1>
          <p className="text-sm text-muted-foreground">Toutes les actions effectuées dans le système</p>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher action ou utilisateur..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous modules</SelectItem>
              {modules.map((m: any) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead>Ancien</TableHead>
                <TableHead>Nouveau</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune entrée</TableCell></TableRow>
              ) : filtered.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                  <TableCell>{profileMap.get(l.user_id) || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                  <TableCell className="capitalize">{l.module}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{l.entity_id ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">{l.old_value ? JSON.stringify(l.old_value) : "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">{l.new_value ? JSON.stringify(l.new_value) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
