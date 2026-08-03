import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Users, RotateCcw } from "lucide-react";
import { toast } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/confirm-dialog";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/data/page-header";
import { ResultCount, SearchField, Toolbar } from "@/components/data/toolbar";
import { TableShell, TableStateRow } from "@/components/data/table-shell";
import { TableSkeleton } from "@/components/data/table-skeleton";
import { EmptyState } from "@/components/data/empty-state";
import { ErrorState } from "@/components/data/error-state";
import { DataPagination, usePagination } from "@/components/data/pagination";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  notes: string | null;
};

type FormState = Omit<Customer, "id">;
const empty: FormState = {
  name: "", email: "", phone: "", address: "", city: "", postal_code: "", notes: "",
};

function CustomersPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const { data: customers = [], isLoading, error, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (p: FormState & { id?: string }) => {
      const { id, ...payload } = p;
      if (id) {
        const { error } = await supabase.from("customers").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Enregistré");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = customers.filter(c =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (c.phone ?? "").includes(q),
  );

  // Client-side: the address book is loaded whole and searched in memory, so
  // the search keeps looking at every customer, not at the page.
  const pagination = usePagination({ total: filtered.length, resetKey: q });
  const pageRows = pagination.slice(filtered);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        subtitle="Gestion du carnet d'adresses"
        actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button className="elev-brand" onClick={() => { setEditing(null); setForm(empty); }}>
              <Plus className="me-2 h-4 w-4" /> Nouveau client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier client" : "Nouveau client"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nom *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Téléphone</Label><Input value={form.phone ?? ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="col-span-2"><Label>Adresse</Label><Input value={form.address ?? ""} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Ville</Label><Input value={form.city ?? ""} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Code postal</Label><Input value={form.postal_code ?? ""} onChange={e => setForm({ ...form, postal_code: e.target.value })} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => upsert.mutate({ ...form, id: editing?.id })} disabled={!form.name || upsert.isPending}>
                {upsert.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Rechercher…" />
        {q && (
          <Button variant="ghost" size="sm" onClick={() => setQ("")}>
            <RotateCcw className="me-1 h-3.5 w-3.5" /> Réinitialiser
          </Button>
        )}
        <ResultCount shown={filtered.length} total={customers.length} />
      </Toolbar>

      {/* No stat banner on this screen, so the table starts higher and can be
          taller than on products or orders. */}
      <TableShell offset="16rem">
        <Table aria-busy={isLoading}>
          <caption className="sr-only">Clients</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead><TableHead>Email</TableHead><TableHead>Téléphone</TableHead>
              <TableHead>Ville</TableHead><TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton rows={8} columns={5} />}
            {!isLoading && error && (
              <TableStateRow colSpan={5}>
                <ErrorState title={t("error_load_customers")} error={error} onRetry={() => refetch()} />
              </TableStateRow>
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <TableStateRow colSpan={5}>
                {customers.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title={t("empty_customers")}
                    description={t("empty_customers_desc")}
                    action={
                      <Button size="sm" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>
                        <Plus className="me-1 h-4 w-4" /> Nouveau client
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Users}
                    title={t("state_no_results_title")}
                    description={t("state_no_results_desc").replace("{total}", String(customers.length))}
                    action={
                      <Button variant="outline" size="sm" onClick={() => setQ("")}>
                        <RotateCcw className="me-1 h-3.5 w-3.5" /> {t("state_reset_filters")}
                      </Button>
                    }
                  />
                )}
              </TableStateRow>
            )}
            {!isLoading && !error && pageRows.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell className="tabular-nums">{c.phone}</TableCell>
                <TableCell>{c.city}</TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-1 text-muted-foreground [&_button]:h-8 [&_button]:w-8">
                    <Button size="icon" variant="ghost" title="Modifier" onClick={() => {
                      setEditing(c);
                      setForm({ name: c.name, email: c.email, phone: c.phone, address: c.address, city: c.city, postal_code: c.postal_code, notes: c.notes });
                      setOpen(true);
                    }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Supprimer" onClick={async () => { if (await confirm({ title: `Supprimer le client ${c.name} ?`, description: "Le client sera définitivement retiré du carnet d'adresses. Les documents déjà émis à son nom sont conservés.", confirmLabel: "Supprimer", destructive: true })) remove.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>

      <DataPagination pagination={pagination} />
    </div>
  );
}
