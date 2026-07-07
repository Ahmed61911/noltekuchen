import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus, Search, Trash2, Eye, FileDown, Loader2, FileSignature,
  CheckCircle2, XCircle, Clock, TrendingUp, Copy, ArrowRightCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateInvoicePdf, type PdfInvoice } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/_app/quotes/")({
  component: QuotesPage,
});

const CURRENCY = "DH";
const STATUS = {
  draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
  sent: { label: "Envoyé", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  accepted: { label: "Accepté", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  refused: { label: "Refusé", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  expired: { label: "Expiré", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
} as const;
type Status = keyof typeof STATUS;

type Quote = {
  id: string;
  quote_number: string;
  customer_id: string | null;
  quote_date: string;
  expiry_date: string | null;
  status: Status;
  subtotal_ht: number;
  tax: number;
  discount: number;
  total_ttc: number;
  notes: string | null;
  customers: { name: string; email: string | null } | null;
};

type Customer = { id: string; name: string; email: string | null };
type Product = { id: string; name: string; reference: string; selling_price: number };

type LineForm = {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
};

const emptyLine = (): LineForm => ({
  product_id: null, description: "", quantity: 1, unit_price: 0, tax_rate: 20, discount: 0,
});

const fmt = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n)} ${CURRENCY}`;

function computeLine(l: LineForm) {
  const ht = l.quantity * l.unit_price - l.discount;
  const tva = Math.max(0, ht) * (l.tax_rate / 100);
  return { ht: Math.max(0, ht), tva, ttc: Math.max(0, ht) + tva };
}

function QuotesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const [customerId, setCustomerId] = useState<string>("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [status, setStatus] = useState<Status>("draft");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, customers(name,email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Quote[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name,email").order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,reference,selling_price").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const totals = useMemo(() => {
    let ht = 0, tva = 0, ttc = 0, disc = 0;
    for (const l of lines) {
      const c = computeLine(l);
      ht += c.ht; tva += c.tva; ttc += c.ttc; disc += l.discount;
    }
    return { ht, tva, ttc, disc };
  }, [lines]);

  const resetForm = () => {
    setCustomerId("");
    setQuoteDate(new Date().toISOString().slice(0, 10));
    setExpiryDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    setStatus("draft"); setNotes(""); setLines([emptyLine()]);
  };

  const create = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter(l => l.description && l.quantity > 0);
      if (validLines.length === 0) throw new Error("Ajoutez au moins une ligne");
      if (!customerId) throw new Error("Sélectionnez un client");

      const { data: quote, error: e1 } = await supabase.from("quotes").insert({
        customer_id: customerId,
        commercial_id: user?.id ?? null,
        quote_date: quoteDate,
        expiry_date: expiryDate,
        status,
        subtotal_ht: totals.ht,
        tax: totals.tva,
        discount: totals.disc,
        total_ttc: totals.ttc,
        notes: notes || null,
        created_by: user?.id ?? null,
      }).select("id").single();
      if (e1) throw e1;

      const itemsPayload = validLines.map(l => {
        const c = computeLine(l);
        return {
          quote_id: quote.id,
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          discount: l.discount,
          total: c.ttc,
        };
      });
      const { error: e2 } = await supabase.from("quote_items").insert(itemsPayload);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Devis créé");
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setOpen(false); resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: Status }) => {
      const { error } = await supabase.from("quotes").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Statut : ${STATUS[vars.newStatus].label}`);
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["quotes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const { data: src, error: e1 } = await supabase.from("quotes").select("*").eq("id", id).single();
      if (e1) throw e1;
      const { data: items, error: e2 } = await supabase.from("quote_items").select("*").eq("quote_id", id);
      if (e2) throw e2;
      const { data: dup, error: e3 } = await supabase.from("quotes").insert({
        customer_id: src.customer_id,
        commercial_id: user?.id ?? null,
        quote_date: new Date().toISOString().slice(0, 10),
        expiry_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        status: "draft",
        subtotal_ht: src.subtotal_ht,
        tax: src.tax,
        discount: src.discount,
        total_ttc: src.total_ttc,
        notes: src.notes,
        created_by: user?.id ?? null,
      }).select("id").single();
      if (e3) throw e3;
      if (items?.length) {
        const rows = items.map(({ id: _id, quote_id: _q, created_at: _c, ...rest }) => ({ ...rest, quote_id: dup.id }));
        const { error: e4 } = await supabase.from("quote_items").insert(rows);
        if (e4) throw e4;
      }
    },
    onSuccess: () => { toast.success("Devis dupliqué"); qc.invalidateQueries({ queryKey: ["quotes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const convert = useMutation({
    mutationFn: async (id: string) => {
      const { data: src, error: e1 } = await supabase.from("quotes").select("*").eq("id", id).single();
      if (e1) throw e1;
      const { data: items, error: e2 } = await supabase.from("quote_items").select("*").eq("quote_id", id);
      if (e2) throw e2;
      const { data: order, error: e3 } = await supabase.from("orders").insert({
        customer_id: src.customer_id,
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        subtotal_ht: Number(src.subtotal_ht),
        tax_amount: Number(src.tax),
        total_ttc: Number(src.total_ttc),
        status: "pending",
        notes: `Issu du devis ${src.quote_number}`,
        created_by: user?.id ?? null,
      }).select("id, order_number").single();
      if (e3) throw e3;
      if (items?.length) {
        const rows = items.map(l => {
          const totalTtc = Number(l.total);
          const rate = Number(l.tax_rate);
          const ht = totalTtc / (1 + rate / 100);
          return {
            order_id: order.id,
            product_id: l.product_id,
            description: l.description ?? "",
            quantity: Number(l.quantity),
            unit_price: Number(l.unit_price),
            tax_rate: rate,
            discount_rate: 0,
            line_total_ht: ht,
            line_tax: totalTtc - ht,
            line_total_ttc: totalTtc,
          };
        });
        const { error: e4 } = await supabase.from("order_items").insert(rows);
        if (e4) throw e4;
      }
      await supabase.from("quotes").update({ status: "accepted" }).eq("id", id);
      return order;
    },
    onSuccess: (order) => {
      toast.success(`Commande ${order.order_number} créée`);
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadPdf = async (id: string) => {
    const { data: qt, error: e1 } = await supabase.from("quotes").select("*, customers(*)").eq("id", id).single();
    if (e1 || !qt) return toast.error("Devis introuvable");
    const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", id).order("created_at");
    const pdfShape: PdfInvoice = {
      invoice_number: qt.quote_number,
      invoice_date: qt.quote_date,
      due_date: qt.expiry_date ?? qt.quote_date,
      status: qt.status,
      subtotal_ht: Number(qt.subtotal_ht),
      tax_amount: Number(qt.tax),
      discount_amount: Number(qt.discount),
      total_ttc: Number(qt.total_ttc),
      notes: qt.notes,
      customer: (qt as { customers?: PdfInvoice["customer"] }).customers ?? null,
      items: (items ?? []).map((it) => ({
        description: it.description ?? "",
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        tax_rate: Number(it.tax_rate),
        discount_rate: 0,
        line_total_ht: Number(it.total) / (1 + Number(it.tax_rate) / 100),
        line_total_ttc: Number(it.total),
      })),
    };
    generateInvoicePdf(pdfShape);
  };

  const sendEmail = (qt: Quote) => {
    const to = qt.customers?.email ?? "";
    const subj = encodeURIComponent(`Devis ${qt.quote_number} - Nolte Küchen`);
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver votre devis ${qt.quote_number} d'un montant de ${fmt(Number(qt.total_ttc))}.\n\nCordialement,\nNolte Küchen`);
    window.location.href = `mailto:${to}?subject=${subj}&body=${body}`;
  };

  const filtered = quotes.filter(qt => {
    if (statusFilter !== "all" && qt.status !== statusFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return qt.quote_number.toLowerCase().includes(s) || (qt.customers?.name ?? "").toLowerCase().includes(s);
  });

  const kpis = useMemo(() => {
    const total = quotes.length;
    const accepted = quotes.filter(q => q.status === "accepted").length;
    const pending = quotes.filter(q => q.status === "sent").length;
    const potential = quotes
      .filter(q => q.status === "sent" || q.status === "draft")
      .reduce((s, q) => s + Number(q.total_ttc), 0);
    const rate = total > 0 ? Math.round((accepted / total) * 100) : 0;
    return { total, accepted, pending, potential, rate };
  }, [quotes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Devis</h1>
          <p className="text-sm text-muted-foreground">Devis clients et conversion en commande</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="me-2 h-4 w-4" /> Nouveau devis</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouveau devis</DialogTitle></DialogHeader>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <Label>Client *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} /></div>
              <div><Label>Expire le</Label><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Produits / Lignes</Label>
                <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}>
                  <Plus className="me-1 h-3 w-3" /> Ligne
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Produit / Description</TableHead>
                      <TableHead className="w-[10%]">Qté</TableHead>
                      <TableHead className="w-[14%]">PU</TableHead>
                      <TableHead className="w-[10%]">Remise</TableHead>
                      <TableHead className="w-[10%]">TVA %</TableHead>
                      <TableHead className="w-[18%] text-right">Total TTC</TableHead>
                      <TableHead className="w-[8%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => {
                      const c = computeLine(l);
                      const update = (patch: Partial<LineForm>) => {
                        const nx = [...lines]; nx[idx] = { ...l, ...patch }; setLines(nx);
                      };
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select value={l.product_id ?? "_custom"} onValueChange={(v) => {
                              if (v === "_custom") { update({ product_id: null }); return; }
                              const p = products.find(x => x.id === v);
                              if (p) update({ product_id: p.id, description: p.name, unit_price: Number(p.selling_price) });
                            }}>
                              <SelectTrigger className="h-8 mb-1"><SelectValue placeholder="Produit…" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_custom">— Libre —</SelectItem>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input className="h-8" placeholder="Description" value={l.description} onChange={e => update({ description: e.target.value })} />
                          </TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} step="0.01" value={l.quantity} onChange={e => update({ quantity: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} step="0.01" value={l.unit_price} onChange={e => update({ unit_price: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} step="0.01" value={l.discount} onChange={e => update({ discount: Number(e.target.value) })} /></TableCell>
                          <TableCell><Input className="h-8" type="number" min={0} max={100} step="0.1" value={l.tax_rate} onChange={e => update({ tax_rate: Number(e.target.value) })} /></TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmt(c.ttc)}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                <div>
                  <Label>Statut</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS) as Status[]).map(k => (
                        <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Card className="p-4 space-y-2 self-start">
                <div className="flex justify-between"><span>Sous-total HT</span><span className="tabular-nums">{fmt(totals.ht)}</span></div>
                <div className="flex justify-between"><span>TVA</span><span className="tabular-nums">{fmt(totals.tva)}</span></div>
                <div className="flex justify-between border-t pt-2 font-semibold text-lg"><span>Total TTC</span><span className="tabular-nums">{fmt(totals.ttc)}</span></div>
              </Card>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                Créer le devis
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={FileSignature} label="Total devis" value={String(kpis.total)} />
        <KpiCard icon={CheckCircle2} label="Taux d'acceptation" value={`${kpis.rate}%`} accent="emerald" />
        <KpiCard icon={TrendingUp} label="CA potentiel" value={fmt(kpis.potential)} />
        <KpiCard icon={Clock} label="En attente" value={String(kpis.pending)} accent="amber" />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="ps-8" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {(Object.keys(STATUS) as Status[]).map(k => (
                <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Expire</TableHead>
              <TableHead className="text-right">Total TTC</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun devis</TableCell></TableRow>
            ) : filtered.map(qt => (
              <TableRow key={qt.id}>
                <TableCell className="font-medium">{qt.quote_number}</TableCell>
                <TableCell>{qt.customers?.name ?? "—"}</TableCell>
                <TableCell>{qt.quote_date}</TableCell>
                <TableCell>{qt.expiry_date ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(qt.total_ttc))}</TableCell>
                <TableCell>
                  <Select value={qt.status} onValueChange={(v) => updateStatus.mutate({ id: qt.id, newStatus: v as Status })}>
                    <SelectTrigger className={`h-7 w-32 border-0 ${STATUS[qt.status].className}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS) as Status[]).map(k => (
                        <SelectItem key={k} value={k}>{STATUS[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" asChild title="Voir">
                    <Link to="/quotes/$id" params={{ id: qt.id }}><Eye className="h-4 w-4" /></Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => downloadPdf(qt.id)} title="PDF">
                    <FileDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => duplicate.mutate(qt.id)} title="Dupliquer">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => convert.mutate(qt.id)} title="Convertir en commande">
                    <ArrowRightCircle className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => sendEmail(qt)} title="Envoyer par email">
                    <XCircle className="h-4 w-4 rotate-45" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer ce devis ?")) remove.mutate(qt.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: typeof FileSignature; label: string; value: string; accent?: "emerald" | "amber" }) {
  const color = accent === "emerald" ? "text-emerald-600 bg-emerald-500/10"
    : accent === "amber" ? "text-amber-600 bg-amber-500/10"
    : "text-primary bg-primary/10";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

void Badge;
