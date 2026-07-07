import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Warehouse as WarehouseIcon, Power } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/audit-log";

export const Route = createFileRoute("/_app/warehouses")({
  component: WarehousesPage,
});

type Warehouse = {
  id: string;
  name: string;
  merchandise: string | null;
  description: string | null;
  address: string | null;
  manager: string | null;
  is_active: boolean;
  created_at: string;
};

type FormState = {
  name: string;
  merchandise: string;
  description: string;
  address: string;
  manager: string;
  is_active: boolean;
};

const empty: FormState = { name: "", merchandise: "", description: "", address: "", manager: "", is_active: true };

function WarehousesPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Warehouse[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: FormState & { id?: string }) => {
      const payload = {
        name: p.name.trim(),
        merchandise: p.merchandise.trim() || null,
        description: p.description.trim() || null,
        address: p.address.trim() || null,
        manager: p.manager.trim() || null,
        is_active: p.is_active,
      };
      if (!payload.name) throw new Error("Le nom du dépôt est requis");
      if (!payload.merchandise) throw new Error("Les marchandises sont requises");
      if (p.id) {
        const { error } = await supabase.from("warehouses").update(payload).eq("id", p.id);
        if (error) throw error;
        await logAction({ action: "update", module: "warehouses", entity_id: p.id, new_value: payload, description: `Dépôt ${payload.name} modifié` });
      } else {
        const { data, error } = await supabase.from("warehouses").insert(payload).select("id").single();
        if (error) throw error;
        await logAction({ action: "create", module: "warehouses", entity_id: data?.id, new_value: payload, description: `Dépôt ${payload.name} créé` });
      }
    },
    onSuccess: () => {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (w: Warehouse) => {
      const { error } = await supabase
        .from("warehouses")
        .update({ is_active: !w.is_active })
        .eq("id", w.id);
      if (error) throw error;
      await logAction({
        action: "update",
        module: "warehouses",
        entity_id: w.id,
        new_value: { is_active: !w.is_active },
        description: `Dépôt ${w.name} ${!w.is_active ? "activé" : "désactivé"}`,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["warehouses"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const prev = warehouses.find((w) => w.id === id);
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
      await logAction({
        action: "delete",
        module: "warehouses",
        entity_id: id,
        old_value: (prev as unknown as Record<string, unknown>) ?? null,
        description: `Dépôt ${prev?.name ?? id} supprimé`,
      });
    },
    onSuccess: () => {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = warehouses.filter((w) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [w.name, w.description, w.address, w.manager]
      .some((v) => (v ?? "").toLowerCase().includes(s));
  });

  function startEdit(w: Warehouse) {
    setEditing(w);
    setForm({
      name: w.name,
      description: w.description ?? "",
      address: w.address ?? "",
      manager: w.manager ?? "",
      is_active: w.is_active,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Dépôts</h1>
          <p className="text-sm text-muted-foreground">Gérer les dépôts et entrepôts</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher..." className="ps-9 w-64" />
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary text-primary-foreground shadow-elegant">
                  <Plus className="me-1 h-4 w-4" /> Nouveau dépôt
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editing ? "Modifier le dépôt" : "Nouveau dépôt"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nom du dépôt">
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <Field label="Responsable">
                    <Input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Adresse">
                      <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Description">
                      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </Field>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-3">
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    <Label className="text-sm">{form.is_active ? "Actif" : "Inactif"}</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button
                    onClick={() => upsert.mutate(editing ? { ...form, id: editing.id } : form)}
                    disabled={upsert.isPending}
                  >
                    Enregistrer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card className="overflow-hidden shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créé le</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Chargement…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Aucun dépôt</TableCell></TableRow>
            )}
            {filtered.map((w) => (
              <TableRow key={w.id}>
                <TableCell><WarehouseIcon className="h-4 w-4 text-muted-foreground" /></TableCell>
                <TableCell>
                  <div className="font-medium">{w.name}</div>
                  {w.description && <div className="text-xs text-muted-foreground line-clamp-1">{w.description}</div>}
                </TableCell>
                <TableCell>{w.manager ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{w.address ?? "—"}</TableCell>
                <TableCell>
                  {w.is_active
                    ? <Badge className="bg-success/15 text-success hover:bg-success/15">Actif</Badge>
                    : <Badge variant="secondary">Inactif</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(w.created_at).toLocaleDateString("fr-FR")}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title={w.is_active ? "Désactiver" : "Activer"} onClick={() => toggleActive.mutate(w)}>
                      <Power className={`h-4 w-4 ${w.is_active ? "text-success" : "text-muted-foreground"}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(w)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Supprimer ce dépôt ?")) remove.mutate(w.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
