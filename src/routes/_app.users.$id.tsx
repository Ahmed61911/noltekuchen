import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { updateUser, setUserPermissionOverride } from "@/lib/users.functions";

export const Route = createFileRoute("/_app/users/$id")({
  component: UserDetailPage,
});

function UserDetailPage() {
  const { id } = useParams({ from: "/_app/users/$id" });
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: roleRow } = useQuery({
    queryKey: ["user_role", id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", id).maybeSingle();
      return data;
    },
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ["permissions_catalog"],
    queryFn: async () => {
      const { data } = await supabase.from("permissions").select("*").order("module").order("action");
      return data ?? [];
    },
  });

  const { data: rolePerms = [] } = useQuery({
    queryKey: ["role_perms", roleRow?.role],
    queryFn: async () => {
      if (!roleRow?.role) return [];
      const { data } = await supabase.from("role_permissions").select("permission_id").eq("role", roleRow.role);
      return (data ?? []).map((r: any) => r.permission_id);
    },
    enabled: !!roleRow?.role,
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["user_perms", id],
    queryFn: async () => {
      const { data } = await supabase.from("user_permissions").select("*").eq("user_id", id);
      return data ?? [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["audit", id],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*")
        .or(`user_id.eq.${id},entity_id.eq.${id}`)
        .order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  // Profile edit
  const [form, setForm] = useState({ full_name: "", username: "", phone: "", department: "" });
  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name ?? "",
      username: profile.username ?? "",
      phone: profile.phone ?? "",
      department: profile.department ?? "",
    });
  }, [profile]);

  const updateFn = useServerFn(updateUser);
  const updateMut = useMutation({
    mutationFn: (d: any) => updateFn({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile", id] }); qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Profil mis à jour"); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const overrideFn = useServerFn(setUserPermissionOverride);
  const overrideMut = useMutation({
    mutationFn: (d: any) => overrideFn({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_perms", id] }),
  });

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    permissions.forEach((p: any) => { (map[p.module] ??= []).push(p); });
    return map;
  }, [permissions]);

  const overrideMap = useMemo(() => new Map(overrides.map((o: any) => [o.permission_id, o.granted])), [overrides]);
  const roleSet = useMemo(() => new Set(rolePerms), [rolePerms]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/users"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <Avatar className="h-12 w-12">
          {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
          <AvatarFallback>{(profile?.full_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold">{profile?.full_name || "—"}</h1>
          <p className="text-sm text-muted-foreground">{profile?.username ?? ""}{roleRow?.role && <Badge variant="outline" className="ml-2">{roleRow.role}</Badge>}</p>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="shadow-card">
            <CardContent className="p-6 grid gap-4 max-w-xl">
              <Field label="Nom complet"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <Field label="Nom d'utilisateur"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
              <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Département"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
              <div>
                <Button onClick={() => updateMut.mutate({ user_id: id, ...form })} disabled={updateMut.isPending}>
                  {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card className="shadow-card">
            <CardContent className="p-6 space-y-6">
              <p className="text-sm text-muted-foreground">
                Cochez pour accorder une permission supplémentaire à l'utilisateur, décochez pour la retirer.
                Les permissions de base héritées du rôle sont indiquées.
              </p>
              {Object.entries(grouped).map(([module, perms]) => (
                <div key={module} className="space-y-2">
                  <h3 className="font-semibold capitalize">{module}</h3>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {perms.map((p) => {
                      const fromRole = roleSet.has(p.id);
                      const override = overrideMap.get(p.id);
                      const checked = override === undefined ? fromRole : override === true;
                      return (
                        <label key={p.id} className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/50">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              const newVal = !!c;
                              if (newVal === fromRole) overrideMut.mutate({ user_id: id, permission_id: p.id, granted: null });
                              else overrideMut.mutate({ user_id: id, permission_id: p.id, granted: newVal });
                            }}
                          />
                          <span className="flex-1 text-sm">{p.label}</span>
                          {fromRole && <Badge variant="outline" className="text-[10px]">rôle</Badge>}
                          {override !== undefined && <Badge className="text-[10px] bg-amber-500/15 text-amber-700">override</Badge>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="shadow-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune activité</TableCell></TableRow>
                  ) : logs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                      <TableCell className="capitalize">{l.module}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-md truncate">
                        {l.new_value ? JSON.stringify(l.new_value) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
