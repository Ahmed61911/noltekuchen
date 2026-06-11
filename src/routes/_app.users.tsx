import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users as UsersIcon, UserPlus, Search, MoreHorizontal, ShieldCheck, ShieldOff,
  KeyRound, Trash2, Edit, History, Eye, Copy, Loader2, UserCheck, UserX, Ban,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import {
  listUsers, createUser, resetUserPassword, setUserStatus, setUserRole, deleteUser, updateUser,
} from "@/lib/users.functions";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

const ROLES = [
  { value: "admin", label: "Administrateur" },
  { value: "manager", label: "Gestionnaire" },
  { value: "commercial", label: "Commercial" },
  { value: "warehouse", label: "Magasinier" },
  { value: "accountant", label: "Comptable" },
  { value: "employee", label: "Utilisateur standard" },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: "Actif", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  inactive: { label: "Inactif", cls: "bg-muted text-muted-foreground" },
  blocked: { label: "Bloqué", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
};

function generatePassword() {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const sym = "!@#$%&*?";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = pick(upper) + pick(lower) + pick(digits) + pick(sym);
  const all = upper + lower + digits + sym;
  let rest = "";
  for (let i = 0; i < 10; i++) rest += pick(all);
  return (base + rest).split("").sort(() => Math.random() - 0.5).join("");
}

function UsersPage() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !isAdmin) nav({ to: "/dashboard" });
  }, [loading, isAdmin, nav]);

  const listFn = useServerFn(listUsers);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return users.filter((u: any) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(u.full_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.username?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      total: users.length,
      active: users.filter((u: any) => u.status === "active").length,
      inactive: users.filter((u: any) => u.status === "inactive").length,
      blocked: users.filter((u: any) => u.status === "blocked").length,
      today: users.filter((u: any) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= today).length,
    };
  }, [users]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", username: "", phone: "", department: "", role: "employee", password: generatePassword() });
  const [createdPwd, setCreatedPwd] = useState<string | null>(null);

  const createFn = useServerFn(createUser);
  const createMut = useMutation({
    mutationFn: (d: any) => createFn({ data: d }),
    onSuccess: () => {
      toast.success("Utilisateur créé");
      setCreatedPwd(form.password);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const resetFn = useServerFn(resetUserPassword);
  const resetMut = useMutation({
    mutationFn: (d: any) => resetFn({ data: d }),
    onSuccess: (_r, v: any) => {
      toast.success("Mot de passe réinitialisé");
      setResetResult(v.password);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });
  const [resetResult, setResetResult] = useState<string | null>(null);

  const statusFn = useServerFn(setUserStatus);
  const statusMut = useMutation({
    mutationFn: (d: any) => statusFn({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Statut mis à jour"); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const roleFn = useServerFn(setUserRole);
  const roleMut = useMutation({
    mutationFn: (d: any) => roleFn({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Rôle modifié"); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const delFn = useServerFn(deleteUser);
  const delMut = useMutation({
    mutationFn: (d: any) => delFn({ data: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Compte supprimé"); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  if (loading || !isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Gestion des utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Comptes, rôles et permissions</p>
        </div>
        <Button onClick={() => { setForm({ email: "", full_name: "", username: "", phone: "", department: "", role: "employee", password: generatePassword() }); setCreatedPwd(null); setCreateOpen(true); }}>
          <UserPlus className="h-4 w-4" /> Nouvel utilisateur
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<UsersIcon className="h-5 w-5" />} label="Total" value={stats.total} tint="bg-primary/10 text-primary" />
        <StatCard icon={<UserCheck className="h-5 w-5" />} label="Actifs" value={stats.active} tint="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" />
        <StatCard icon={<UserX className="h-5 w-5" />} label="Inactifs" value={stats.inactive} tint="bg-muted text-muted-foreground" />
        <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Connexions aujourd'hui" value={stats.today} tint="bg-blue-500/15 text-blue-700 dark:text-blue-400" />
        <StatCard icon={<Ban className="h-5 w-5" />} label="Bloqués" value={stats.blocked} tint="bg-rose-500/15 text-rose-700 dark:text-rose-400" />
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher nom, email, nom d'utilisateur..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous rôles</SelectItem>
              {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
              <SelectItem value="blocked">Bloqué</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Aucun utilisateur</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Nom d'utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Créé</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u: any) => {
                  const status = STATUS_BADGE[u.status] ?? STATUS_BADGE.active;
                  const role = ROLES.find((r) => r.value === u.role);
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          {u.avatar_url ? <AvatarImage src={u.avatar_url} /> : null}
                          <AvatarFallback className="text-xs">{(u.full_name || u.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.username || "—"}</TableCell>
                      <TableCell>{u.email || "—"}</TableCell>
                      <TableCell>{u.phone || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{role?.label ?? u.role}</Badge></TableCell>
                      <TableCell>{u.department || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Jamais"}</TableCell>
                      <TableCell><Badge className={status.cls}>{status.label}</Badge></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem asChild><Link to="/users/$id" params={{ id: u.id }}><Eye className="h-4 w-4 mr-2" /> Voir profil</Link></DropdownMenuItem>
                            <DropdownMenuItem asChild><Link to="/users/$id" params={{ id: u.id }} search={{ tab: "history" } as any}><History className="h-4 w-4 mr-2" /> Historique</Link></DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <ChangeRoleMenu currentRole={u.role} onChange={(role) => roleMut.mutate({ user_id: u.id, role })} />
                            <DropdownMenuItem onClick={() => {
                              const pwd = generatePassword();
                              resetMut.mutate({ user_id: u.id, password: pwd });
                            }}>
                              <KeyRound className="h-4 w-4 mr-2" /> Réinitialiser mot de passe
                            </DropdownMenuItem>
                            {u.status === "active" ? (
                              <DropdownMenuItem onClick={() => statusMut.mutate({ user_id: u.id, status: "inactive" })}>
                                <UserX className="h-4 w-4 mr-2" /> Désactiver
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => statusMut.mutate({ user_id: u.id, status: "active" })}>
                                <UserCheck className="h-4 w-4 mr-2" /> Activer
                              </DropdownMenuItem>
                            )}
                            {u.status === "blocked" ? (
                              <DropdownMenuItem onClick={() => statusMut.mutate({ user_id: u.id, status: "active" })}>
                                <ShieldCheck className="h-4 w-4 mr-2" /> Débloquer
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => statusMut.mutate({ user_id: u.id, status: "blocked" })}>
                                <Ban className="h-4 w-4 mr-2" /> Bloquer
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => {
                              if (confirm(`Supprimer le compte de ${u.full_name || u.email} ?`)) delMut.mutate({ user_id: u.id });
                            }}><Trash2 className="h-4 w-4 mr-2" /> Supprimer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreatedPwd(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvel utilisateur</DialogTitle></DialogHeader>
          {createdPwd ? (
            <div className="space-y-3">
              <p className="text-sm">Compte créé. Communiquez le mot de passe temporaire à l'utilisateur :</p>
              <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
                <span className="flex-1 break-all">{createdPwd}</span>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdPwd); toast.success("Copié"); }}><Copy className="h-3 w-3" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">Ce mot de passe ne sera plus affiché.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              <Field label="Nom complet"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Nom d'utilisateur"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                <Field label="Département"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
              </div>
              <Field label="Rôle">
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Mot de passe temporaire">
                <div className="flex items-center gap-2">
                  <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="font-mono" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, password: generatePassword() })}>Régénérer</Button>
                </div>
              </Field>
            </div>
          )}
          <DialogFooter>
            {createdPwd ? (
              <Button onClick={() => setCreateOpen(false)}>Fermer</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
                <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.email || !form.full_name || form.password.length < 8}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Créer
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset result dialog */}
      <Dialog open={resetResult !== null} onOpenChange={(o) => !o && setResetResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Mot de passe réinitialisé</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Communiquez ce nouveau mot de passe à l'utilisateur :</p>
            <div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
              <span className="flex-1 break-all">{resetResult}</span>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(resetResult!); toast.success("Copié"); }}><Copy className="h-3 w-3" /></Button>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setResetResult(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChangeRoleMenu({ currentRole, onChange }: { currentRole: string; onChange: (r: string) => void }) {
  return (
    <>
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Changer de rôle</div>
      {ROLES.map((r) => (
        <DropdownMenuItem key={r.value} disabled={r.value === currentRole} onClick={() => onChange(r.value)}>
          <ShieldCheck className="h-4 w-4 mr-2 opacity-50" /> {r.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function StatCard({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: number; tint: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${tint}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
