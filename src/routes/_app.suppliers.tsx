import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Pencil, Truck } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/data/page-header";
import { TableShell, TableStateRow } from "@/components/data/table-shell";
import { TableSkeleton } from "@/components/data/table-skeleton";
import { EmptyState } from "@/components/data/empty-state";
import { ErrorState } from "@/components/data/error-state";
import { DataPagination, usePagination } from "@/components/data/pagination";

export const Route = createFileRoute("/_app/suppliers")({
  component: SuppliersPage,
});

type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};
const empty = { name: "", contact_name: "", email: "", phone: "", address: "" };

function SuppliersPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(empty);

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("suppliers").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Client-side: the screen has no filter bar at all, it lists the contact book
  // as it comes back from the query.
  const pagination = usePagination({ total: data.length });
  const pageRows = pagination.slice(data);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fournisseurs"
        subtitle="Carnet de contacts"
        actions={isAdmin && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
            <DialogTrigger asChild>
              <Button className="elev-brand"><Plus className="me-1 h-4 w-4" />Ajouter</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau fournisseur"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                {(["name", "contact_name", "email", "phone", "address"] as const).map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label className="text-xs capitalize">{k.replace("_", " ")}</Label>
                    <Input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>Enregistrer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      {/* No filter bar and no stat banner here, so the table can start higher
          and run taller than on the transactional screens. */}
      <TableShell offset="13rem">
        <Table aria-busy={isLoading}>
          <caption className="sr-only">Fournisseurs</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
              {isAdmin && <TableHead className="text-end">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton rows={8} columns={isAdmin ? 5 : 4} />}
            {!isLoading && error && (
              <TableStateRow colSpan={isAdmin ? 5 : 4}>
                <ErrorState title={t("error_load_suppliers")} error={error} onRetry={() => refetch()} />
              </TableStateRow>
            )}
            {!isLoading && !error && data.length === 0 && (
              <TableStateRow colSpan={isAdmin ? 5 : 4}>
                <EmptyState
                  icon={Truck}
                  title={t("empty_suppliers")}
                  description={t("empty_suppliers_desc")}
                  action={isAdmin ? (
                    <Button size="sm" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>
                      <Plus className="me-1 h-4 w-4" /> Ajouter
                    </Button>
                  ) : undefined}
                />
              </TableStateRow>
            )}
            {!isLoading && !error && pageRows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.contact_name ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.email ?? "—"}</TableCell>
                <TableCell className="text-sm tabular-nums">{s.phone ?? "—"}</TableCell>
                {isAdmin && (
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1 text-muted-foreground [&_button]:h-8 [&_button]:w-8">
                      <Button variant="ghost" size="icon" title="Modifier" onClick={() => { setEditing(s); setForm({ name: s.name, contact_name: s.contact_name ?? "", email: s.email ?? "", phone: s.phone ?? "", address: s.address ?? "" }); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Supprimer" onClick={async () => { if (await confirm({ title: `Supprimer le fournisseur ${s.name} ?`, description: "Les produits qui lui étaient rattachés ne seront plus associés à aucun fournisseur.", confirmLabel: "Supprimer", destructive: true })) remove.mutate(s.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>

      <DataPagination pagination={pagination} />
    </div>
  );
}
