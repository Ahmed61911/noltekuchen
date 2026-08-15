import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, Eye, FileText, Loader2, Trash2, FileDown } from "lucide-react";
import { toast } from "@/lib/notify";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { DataPagination, usePagination } from "@/components/data/pagination";
import { generateQuotePdf, type PdfQuote } from "@/lib/quote-pdf";

export const Route = createFileRoute("/_app/quotes/")({
  component: QuotesPage,
});

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-slate-500/15 text-slate-700" },
  sent: { label: "Envoyé", className: "bg-blue-500/15 text-blue-700" },
  accepted: { label: "Accepté", className: "bg-emerald-500/15 text-emerald-700" },
  refused: { label: "Refusé", className: "bg-rose-500/15 text-rose-700" },
  expired: { label: "Expiré", className: "bg-amber-500/15 text-amber-700" },
};

function QuotesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("_new");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name").order("name");
      return data ?? [];
    },
  });

  const createQuote = useMutation({
    mutationFn: async () => {
      let customerId: string | null = null;
      if (selectedCustomerId && selectedCustomerId !== "_new" && selectedCustomerId !== "_none") {
        // Use existing customer
        customerId = selectedCustomerId;
      } else if (selectedCustomerId === "_new" && clientName.trim()) {
        // Create new customer
        const { data: newCust, error: cErr } = await supabase
          .from("customers")
          .insert({
            name: clientName.trim(),
            phone: clientPhone.trim() || null,
            email: clientEmail.trim() || null,
            address: clientAddress.trim() || null,
          })
          .select("id")
          .single();
        if (cErr) throw cErr;
        customerId = newCust.id;
        qc.invalidateQueries({ queryKey: ["customers-list"] });
      }

      const { data, error } = await supabase.from("quotes").insert({
        customer_id: customerId,
        commercial_id: user?.id,
        status: "draft",
        quote_date: new Date().toISOString().split("T")[0],
        expiry_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        total_ttc: 0,
      }).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setCreateOpen(false);
      setSelectedCustomerId("_new"); setClientName(""); setClientPhone(""); setClientEmail(""); setClientAddress("");
      navigate({ to: "/quotes/$id", params: { id: data.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Devis supprimé"); qc.invalidateQueries({ queryKey: ["quotes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadPdf = async (id: string) => {
    const { data: quote, error: e1 } = await supabase
      .from("quotes").select("*, customers(*)").eq("id", id).single();
    if (e1 || !quote) { toast.error("Devis introuvable"); return; }
    const { data: items, error: e2 } = await supabase
      .from("quote_items").select("*, products(name, reference)").eq("quote_id", id).order("created_at");
    if (e2) { toast.error(e2.message); return; }
    
    generateQuotePdf({
      ...quote,
      customer: quote.customers,
      items: items.map((it: any) => ({
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount,
        total: it.total,
        code: it.products?.reference
      }))
    } as PdfQuote);
  };

  const filtered = useMemo(() => {
    return quotes.filter((q: any) => {
      if (statusF !== "all" && q.status !== statusF) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return q.quote_number?.toLowerCase().includes(s) || (q.customers?.name ?? "").toLowerCase().includes(s);
    });
  }, [quotes, search, statusF]);

  const pagination = usePagination({
    total: filtered.length,
    resetKey: `${search}-${statusF}`,
  });
  const paged = pagination.slice(filtered);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Devis</h1>
          <p className="text-sm text-muted-foreground">Gérez et générez vos devis clients</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nouveau Devis</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un devis</DialogTitle></DialogHeader>
            <div className="py-4 space-y-3">
              <div>
                <Label>Client</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Aucun (prospect) —</SelectItem>
                    <SelectItem value="_new">+ Nouveau client</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedCustomerId === "_new" && (
                <>
                  <div>
                    <Label>Nom du client</Label>
                    <Input className="mt-1" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Téléphone</Label>
                      <Input className="mt-1" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input className="mt-1" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Adresse</Label>
                    <Input className="mt-1" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button onClick={() => createQuote.mutate()} disabled={createQuote.isPending}>
                {createQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null} Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher (Numéro, client)..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Aucun devis trouvé</TableCell></TableRow>
              ) : paged.map(q => {
                const meta = STATUS_META[q.status] ?? STATUS_META.draft;
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">
                      <Link to="/quotes/$id" params={{ id: q.id }} className="hover:underline flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" /> {q.quote_number}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(q.quote_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{q.customers?.name ?? <span className="italic text-muted-foreground">Prospect</span>}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{Number(q.total_ttc).toLocaleString("fr-FR")} DH</TableCell>
                    <TableCell><Badge variant="outline" className={meta.className}>{meta.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to="/quotes/$id" params={{ id: q.id }}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => downloadPdf(q.id)}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={async () => {
                          if (q.status === 'accepted') {
                            toast.error("Ce devis est lié à une commande et ne peut pas être supprimé.");
                            return;
                          }
                          if (await confirm({ title: "Supprimer", message: "Voulez-vous vraiment supprimer ce devis ?" })) removeQuote.mutate(q.id);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <DataPagination pagination={pagination} />
      </Card>
    </div>
  );
}
