import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search, Pencil, Trash2, Plus, RotateCcw, Eye, EyeOff, Lock, Unlock, KeyRound, Copy, Loader2, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  listUsers, createUser, setUserStatus, setUserRole, deleteUser, updateUser, resetUserPassword,
} from "@/lib/users.functions";
import { listRoles } from "@/lib/roles.functions";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_app/users/")({
  component: UsersPage,
});

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  manager: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  commercial: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  warehouse: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  accountant: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  employee: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};
function roleColor(key: string) { return ROLE_COLORS[key] ?? "bg-slate-500/15 text-slate-700 dark:text-slate-300"; }

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: "Actif", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  inactive: { label: "Inactif", cls: "bg-muted text-muted-foreground" },
  blocked: { label: "Bloqué", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
};

const QUICK_PERMS = [
  { key: "stock", label: "Gestion du stock", modules: ["stock"] },
  { key: "sales", label: "Gestion des ventes", modules: ["sales"] },
  { key: "orders", label: "Gestion des achats", modules: ["orders"] },
  { key: "products_edit", label: "Modification des produits", modules: ["products"], actions: ["create", "update"] },
  { key: "delete", label: "Suppression des données", actionsOnly: ["delete"] },
  { key: "users", label: "Gestion des utilisateurs", modules: ["users"] },
];

function generatePassword() {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const sym = "!@#$%&*?";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const all = upper + lower + digits + sym;
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(sym);
  for (let i = 0; i < 10; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

const AVATAR_COLORS = ["bg-orange-500/20 text-orange-700", "bg-emerald-500/20 text-emerald-700", "bg-amber-500/20 text-amber-700", "bg-blue-500/20 text-blue-700", "bg-rose-500/20 text-rose-700", "bg-violet-500/20 text-violet-700"];
function colorFor(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff; return AVATAR_COLORS[h % AVATAR_COLORS.length]; }
function initials(s: string) { return s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }

function UsersPage() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();

  useEffect(() => { if (!loading && !isAdmin) nav({ to: "/dashboard" }); }, [loading, isAdmin, nav]);

  const listFn = useServerFn(listUsers);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"], queryFn: () => listFn(), enabled: isAdmin,
  });

  const rolesFn = useServerFn(listRoles);
  const { data: rolesList = [] } = useQuery({
    queryKey: ["roles"], queryFn: () => rolesFn(), enabled: isAdmin,
  });
  const roleByKey = useMemo(() => {
    const m = new Map<string, { key: string; label: string; is_system: boolean }>();
    (rolesList as any[]).forEach((r) => m.set(r.key, r));
    return m;
  }, [rolesList]);

  // permissions catalog for summary
  const { data: catalog = [] } = useQuery({
    queryKey: ["perm_catalog"],
    queryFn: async () => {
      const { data } = await supabase.from("permissions").select("id, module, action");
      return data ?? [];
    },
    enabled: isAdmin,
  });
  const { data: rolePerms = [] } = useQuery({
    queryKey: ["role_perm_all"],
    queryFn: async () => {
      const { data } = await supabase.from("role_permissions").select("role, permission_id");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const permsByRole = useMemo(() => {
    const cat = new Map(catalog.map((c: any) => [c.id, c]));
    const m: Record<string, Set<string>> = {};
    rolePerms.forEach((rp: any) => {
      const c: any = cat.get(rp.permission_id);
      if (!c) return;
      (m[rp.role] ??= new Set()).add(c.module);
    });
    return m;
  }, [catalog, rolePerms]);

  function permSummary(role: string) {
    if (role === "admin") return "Accès complet";
    const mods = Array.from(permsByRole[role] ?? []);
    if (mods.length === 0) return "Lecture seule";
    const labels: Record<string, string> = { stock: "Stock", sales: "Ventes", orders: "Achats", products: "Produits", customers: "Clients", suppliers: "Fournisseurs", reports: "Rapports", users: "Utilisateurs" };
    return mods.slice(0, 4).map((m) => labels[m] ?? m).join(", ");
  }

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => users.filter((u: any) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return u.full_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
    }
    return true;
  }), [users, search, roleFilter, statusFilter]);

  // Create / Edit dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const empty = { full_name: "", email: "", password: generatePassword(), role: "employee", phone: "", department: "" };
  const [form, setForm] = useState(empty);
  const [showPwd, setShowPwd] = useState(false);
  const [createdPwd, setCreatedPwd] = useState<string | null>(null);

  function openCreate() {
    setEditing(null); setForm({ ...empty, password: generatePassword() }); setCreatedPwd(null); setOpen(true);
  }
  function openEdit(u: any) {
    setEditing(u);
    setForm({ full_name: u.full_name ?? "", email: u.email ?? "", password: "", role: u.role ?? "employee", phone: u.phone ?? "", department: u.department ?? "" });
    setCreatedPwd(null); setOpen(true);
  }

  const createFn = useServerFn(createUser);
  const updateFn = useServerFn(updateUser);
  const roleFn = useServerFn(setUserRole);
  const resetFn = useServerFn(resetUserPassword);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateFn({ data: { user_id: editing.id, full_name: form.full_name, phone: form.phone, department: form.department } });
        if (form.role !== editing.role) await roleFn({ data: { user_id: editing.id, role: form.role } });
        return { editing: true };
      }
      await createFn({ data: form as any });
      return { editing: false };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      if (!r.editing) { setCreatedPwd(form.password); toast.success("Utilisateur créé"); }
      else { toast.success("Utilisateur mis à jour"); setOpen(false); }
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const statusFn = useServerFn(setUserStatus);
  const statusMut = useMutation({ mutationFn: (d: any) => statusFn({ data: d }), onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }) });

  const delFn = useServerFn(deleteUser);
  const delMut = useMutation({
    mutationFn: (d: any) => delFn({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Compte supprimé"); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const [resetTarget, setResetTarget] = useState<any>(null);
  const [resetPwd, setResetPwd] = useState<string | null>(null);
  const resetMut = useMutation({
    mutationFn: async (uid: string) => {
      const pwd = generatePassword();
      await resetFn({ data: { user_id: uid, password: pwd } });
      return pwd;
    },
    onSuccess: (pwd) => { setResetPwd(pwd); toast.success("Mot de passe réinitialisé"); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  if (loading || !isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Gérez les utilisateurs et leurs permissions</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Créer utilisateur</Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher par nom ou email…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rôle</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rôles</SelectItem>
                  {(rolesList as any[]).map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                  <SelectItem value="blocked">Bloqué</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }}>
              <RotateCcw className="h-4 w-4" /> Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Aucun utilisateur</TableCell></TableRow>
                ) : filtered.map((u: any) => {
                  const status = STATUS_BADGE[u.status] ?? STATUS_BADGE.active;
                  const role = roleByKey.get(u.role);
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className={`h-9 w-9 ${colorFor(u.full_name || u.email || "?")}`}>
                            {u.avatar_url ? <AvatarImage src={u.avatar_url} /> : null}
                            <AvatarFallback className="bg-transparent text-xs font-medium">{initials(u.full_name || u.email || "??")}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.full_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                      <TableCell><Badge className={roleColor(u.role)}>{role?.label ?? u.role}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{permSummary(u.role)}</TableCell>
                      <TableCell><Badge className={status.cls}>{status.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Jamais"}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Réinitialiser mot de passe" onClick={async () => { if (await confirm({ title: `Réinitialiser le mot de passe de ${u.full_name || u.email} ?`, description: "Son mot de passe actuel cessera immédiatement de fonctionner. Un nouveau mot de passe sera généré et affiché une seule fois — notez-le avant de fermer.", confirmLabel: "Réinitialiser", destructive: true })) { setResetTarget(u); setResetPwd(null); resetMut.mutate(u.id); } }}><KeyRound className="h-4 w-4" /></Button>
                          {u.status === "blocked" ? (
                            <Button variant="ghost" size="icon" title="Débloquer" onClick={async () => { if (await confirm({ title: `Débloquer ${u.full_name || u.email} ?`, description: "Cette personne pourra de nouveau se connecter et agir selon son rôle.", confirmLabel: "Débloquer" })) statusMut.mutate({ user_id: u.id, status: "active" }); }}><Unlock className="h-4 w-4 text-emerald-600" /></Button>
                          ) : (
                            <Button variant="ghost" size="icon" title="Bloquer" onClick={async () => { if (await confirm({ title: `Bloquer ${u.full_name || u.email} ?`, description: "Cette personne ne pourra plus se connecter. Ses données et son historique sont conservés.", confirmLabel: "Bloquer", destructive: true })) statusMut.mutate({ user_id: u.id, status: "blocked" }); }}><Lock className="h-4 w-4" /></Button>
                          )}
                          <Button variant="ghost" size="icon" title="Modifier" onClick={() => openEdit(u)}><Pencil className="h-4 w-4 text-blue-600" /></Button>
                          <Button variant="ghost" size="icon" title="Supprimer" onClick={async () => { if (await confirm({ title: `Supprimer ${u.full_name || u.email} ?`, description: "Le compte et son accès seront définitivement supprimés. Cette action est irréversible — pour un départ temporaire, préférez « Bloquer ».", confirmLabel: "Supprimer définitivement", destructive: true })) delMut.mutate({ user_id: u.id }); }}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span>Affichage de {filtered.length} sur {users.length} utilisateurs</span>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreatedPwd(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Modifier l'utilisateur" : "Créer un utilisateur"}</DialogTitle></DialogHeader>
          {createdPwd ? (
            <div className="space-y-3">
              <p className="text-sm">Compte créé. Communiquez le mot de passe temporaire :</p>
              <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
                <span className="flex-1 break-all">{createdPwd}</span>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdPwd); toast.success("Copié"); }}><Copy className="h-3 w-3" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">Ce mot de passe ne sera plus affiché.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-4">
                <Field label="Nom complet">
                  <Input placeholder="Entrez le nom complet" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" placeholder="exemple@mail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
                </Field>
                {!editing && (
                  <Field label="Mot de passe">
                    <div className="relative">
                      <Input type={showPwd ? "text" : "password"} placeholder="Entrez le mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pr-20 font-mono" />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPwd((v) => !v)}>
                          {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({ ...form, password: generatePassword() })} title="Régénérer">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="Département"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
                </div>
              </div>
              <div className="space-y-4">
                <Field label="Rôle">
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionnez un rôle" /></SelectTrigger>
                    <SelectContent>
                      {(rolesList as any[]).map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                      <SelectSeparator />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent"
                        onClick={(e) => { e.preventDefault(); nav({ to: "/roles" }); }}
                      >
                        <Plus className="h-4 w-4" /> Ajouter un nouveau rôle
                      </button>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="space-y-2">
                  <Label className="text-sm">Permissions</Label>
                  <p className="text-xs text-muted-foreground">Permissions héritées du rôle sélectionné. Détail fin sur la page utilisateur.</p>
                  <div className="space-y-2 rounded-md border p-3">
                    {QUICK_PERMS.map((p) => {
                      const inherited = form.role === "admin" ||
                        (p.modules && p.modules.some((m) => (permsByRole[form.role] ?? new Set()).has(m)));
                      return (
                        <label key={p.key} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={!!inherited} disabled />
                          <span className={inherited ? "" : "text-muted-foreground"}>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {createdPwd ? (
              <Button onClick={() => setOpen(false)}>Fermer</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.full_name || (!editing && (!form.email || form.password.length < 8))}>
                  {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password result */}
      <Dialog open={resetPwd !== null} onOpenChange={(o) => { if (!o) { setResetPwd(null); setResetTarget(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Mot de passe réinitialisé</DialogTitle></DialogHeader>
          <p className="text-sm">Nouveau mot de passe pour <span className="font-medium">{resetTarget?.full_name || resetTarget?.email}</span> :</p>
          <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
            <span className="flex-1 break-all">{resetPwd}</span>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(resetPwd!); toast.success("Copié"); }}><Copy className="h-3 w-3" /></Button>
          </div>
          <DialogFooter><Button onClick={() => { setResetPwd(null); setResetTarget(null); }}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-sm">{label}</Label>{children}</div>;
}
