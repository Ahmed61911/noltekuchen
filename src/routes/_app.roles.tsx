import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Pencil, Trash2, Shield, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import {
  listRoles, listPermissionsCatalog, listRolePermissions,
  createRole, renameRole, deleteRole, setRolePermissions,
} from "@/lib/roles.functions";

export const Route = createFileRoute("/_app/roles")({ component: RolesPage });

const ACTIONS: { key: string; label: string }[] = [
  { key: "view", label: "Voir" },
  { key: "create", label: "Ajouter" },
  { key: "update", label: "Modifier" },
  { key: "delete", label: "Supprimer" },
  { key: "export", label: "Exporter" },
  { key: "print", label: "Imprimer" },
];

const MODULE_LABELS: Record<string, string> = {
  products: "Produits", stock: "Stock", sales: "Ventes", orders: "Commandes",
  customers: "Clients", suppliers: "Fournisseurs", reports: "Rapports", users: "Utilisateurs",
};

function RolesPage() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => { if (!loading && !isAdmin) nav({ to: "/dashboard" }); }, [loading, isAdmin, nav]);

  const rolesFn = useServerFn(listRoles);
  const catFn = useServerFn(listPermissionsCatalog);
  const rpFn = useServerFn(listRolePermissions);

  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: () => rolesFn(), enabled: isAdmin });
  const { data: catalog = [] } = useQuery({ queryKey: ["perm_catalog_full"], queryFn: () => catFn(), enabled: isAdmin });
  const { data: rolePerms = [] } = useQuery({ queryKey: ["role_perm_all"], queryFn: () => rpFn(), enabled: isAdmin });

  const modules = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((c: any) => set.add(c.module));
    return Array.from(set);
  }, [catalog]);

  // module x action => permission id
  const permIndex = useMemo(() => {
    const m = new Map<string, string>();
    catalog.forEach((c: any) => m.set(`${c.module}:${c.action}`, c.id));
    return m;
  }, [catalog]);

  const permsByRole = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    rolePerms.forEach((rp: any) => { (m[rp.role] ??= new Set()).add(rp.permission_id); });
    return m;
  }, [rolePerms]);

  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && roles.length) setSelected(roles[0].key);
  }, [roles, selected]);

  const currentRole = roles.find((r: any) => r.key === selected);
  const currentIds = permsByRole[selected ?? ""] ?? new Set<string>();

  // Draft toggles
  const [draft, setDraft] = useState<Set<string>>(new Set());
  useEffect(() => { setDraft(new Set(currentIds)); }, [selected, rolePerms]);

  const dirty = useMemo(() => {
    if (draft.size !== currentIds.size) return true;
    for (const id of draft) if (!currentIds.has(id)) return true;
    return false;
  }, [draft, currentIds]);

  const isAdminRole = selected === "admin";

  function toggle(pid: string | undefined) {
    if (!pid || isAdminRole) return;
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  }
  function toggleRow(module: string) {
    if (isAdminRole) return;
    const ids = ACTIONS.map((a) => permIndex.get(`${module}:${a.key}`)).filter(Boolean) as string[];
    const allOn = ids.every((id) => draft.has(id));
    setDraft((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  const saveFn = useServerFn(setRolePermissions);
  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { role: selected!, permission_ids: Array.from(draft) } }),
    onSuccess: () => { toast.success("Permissions mises à jour"); qc.invalidateQueries({ queryKey: ["role_perm_all"] }); qc.invalidateQueries({ queryKey: ["user_permissions"] }); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  // Create role
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPerms, setNewPerms] = useState<Set<string>>(new Set());
  const createFn = useServerFn(createRole);
  const createMut = useMutation({
    mutationFn: () => createFn({ data: { label: newLabel, permission_ids: Array.from(newPerms) } }),
    onSuccess: (r) => {
      toast.success("Rôle créé");
      setCreateOpen(false); setNewLabel(""); setNewPerms(new Set());
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["role_perm_all"] });
      setSelected(r.key);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  // Rename
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameLabel, setRenameLabel] = useState("");
  const renameFn = useServerFn(renameRole);
  const renameMut = useMutation({
    mutationFn: () => renameFn({ data: { key: selected!, label: renameLabel } }),
    onSuccess: () => { toast.success("Rôle renommé"); setRenameOpen(false); qc.invalidateQueries({ queryKey: ["roles"] }); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const delFn = useServerFn(deleteRole);
  const delMut = useMutation({
    mutationFn: (key: string) => delFn({ data: { key } }),
    onSuccess: () => {
      toast.success("Rôle supprimé");
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["role_perm_all"] });
      setSelected("admin");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  if (loading || !isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Gestion des rôles</h1>
          <p className="text-sm text-muted-foreground">Créez des rôles et définissez leurs permissions par module.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Nouveau rôle</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Rôles</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {roles.map((r: any) => {
                const active = r.key === selected;
                return (
                  <button
                    key={r.key}
                    onClick={() => setSelected(r.key)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-sm text-start transition-colors hover:bg-accent ${active ? "bg-accent" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      {r.is_system && <Shield className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="font-medium">{r.label}</span>
                    </span>
                    {r.is_system ? <Badge variant="secondary" className="text-[10px]">Système</Badge> : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{currentRole?.label ?? "—"}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {isAdminRole
                  ? "Le rôle Admin dispose de tous les droits — non modifiable."
                  : "Cochez les permissions accordées à ce rôle."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {currentRole && !currentRole.is_system && (
                <>
                  <Button variant="outline" size="sm" onClick={() => { setRenameLabel(currentRole.label); setRenameOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" /> Renommer
                  </Button>
                  <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => { if (confirm(`Supprimer le rôle "${currentRole.label}" ? Les utilisateurs concernés reviendront au rôle Employé.`)) delMut.mutate(currentRole.key); }}>
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </Button>
                </>
              )}
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending || isAdminRole}>
                {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  {ACTIONS.map((a) => <TableHead key={a.key} className="text-center">{a.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((mod) => (
                  <TableRow key={mod}>
                    <TableCell>
                      <button className="font-medium hover:underline disabled:no-underline" disabled={isAdminRole} onClick={() => toggleRow(mod)}>
                        {MODULE_LABELS[mod] ?? mod}
                      </button>
                    </TableCell>
                    {ACTIONS.map((a) => {
                      const pid = permIndex.get(`${mod}:${a.key}`);
                      const on = isAdminRole ? true : (pid ? draft.has(pid) : false);
                      return (
                        <TableCell key={a.key} className="text-center">
                          {pid ? (
                            <Checkbox checked={on} disabled={isAdminRole} onCheckedChange={() => toggle(pid)} />
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Nouveau rôle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom du rôle</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ex : Chef de dépôt" />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="max-h-[400px] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      {ACTIONS.map((a) => <TableHead key={a.key} className="text-center">{a.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map((mod) => (
                      <TableRow key={mod}>
                        <TableCell className="font-medium">{MODULE_LABELS[mod] ?? mod}</TableCell>
                        {ACTIONS.map((a) => {
                          const pid = permIndex.get(`${mod}:${a.key}`);
                          return (
                            <TableCell key={a.key} className="text-center">
                              {pid ? (
                                <Checkbox
                                  checked={newPerms.has(pid)}
                                  onCheckedChange={() => setNewPerms((p) => { const n = new Set(p); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; })}
                                />
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate()} disabled={!newLabel.trim() || createMut.isPending}>
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Renommer le rôle</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Nouveau nom</Label>
            <Input value={renameLabel} onChange={(e) => setRenameLabel(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Annuler</Button>
            <Button onClick={() => renameMut.mutate()} disabled={!renameLabel.trim() || renameMut.isPending}>
              {renameMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
