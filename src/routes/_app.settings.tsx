import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2, Palette, Tags, Warehouse, Package, ShoppingCart, Truck,
  Bell, Database, Shield, ClipboardList, Mail, Sparkles, Loader2, Save,
  Plus, Pencil, Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

type CompanySettings = {
  id: string;
  company_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  ice: string | null;
  if_number: string | null;
  rc: string | null;
  patente: string | null;
  currency: string;
  default_vat: number;
  default_language: string;
  theme: string;
  primary_color: string;
  date_format: string;
  time_format: string;
};

function SettingsPage() {
  const { isAdmin } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Configuration de l'entreprise, personnalisation et catalogues de référence.
        </p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto flex-wrap gap-1">
            <TabsTrigger value="company" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Entreprise</TabsTrigger>
            <TabsTrigger value="personalization" className="gap-1.5"><Palette className="h-3.5 w-3.5" /> Personnalisation</TabsTrigger>
            <TabsTrigger value="types" className="gap-1.5"><Tags className="h-3.5 w-3.5" /> Types</TabsTrigger>
            <TabsTrigger value="warehouses" className="gap-1.5"><Warehouse className="h-3.5 w-3.5" /> Dépôts</TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Produits</TabsTrigger>
            <TabsTrigger value="sales" className="gap-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Ventes</TabsTrigger>
            <TabsTrigger value="purchases" className="gap-1.5"><Truck className="h-3.5 w-3.5" /> Achats</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-3.5 w-3.5" /> Notifications</TabsTrigger>
            <TabsTrigger value="backup" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Sauvegarde</TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Sécurité</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Journalisation</TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> IA</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="company" className="mt-6"><CompanyTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="personalization" className="mt-6"><PersonalizationTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="types" className="mt-6"><TypesTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="warehouses" className="mt-6"><ComingSoon title="Paramètres des dépôts" description="Dépôt par défaut, transferts entre dépôts, validation avant transfert." /></TabsContent>
        <TabsContent value="products" className="mt-6"><ComingSoon title="Paramètres des produits" description="Code produit auto, seuil d'alerte par défaut, unité par défaut, TVA par défaut." /></TabsContent>
        <TabsContent value="sales" className="mt-6"><ComingSoon title="Paramètres des ventes" description="Numérotation, devis, bons de livraison, conditions de paiement." /></TabsContent>
        <TabsContent value="purchases" className="mt-6"><ComingSoon title="Paramètres des achats" description="Numérotation fournisseur, validation avant réception, réceptions partielles." /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><ComingSoon title="Notifications" description="Stock faible, nouveau client, nouvelle commande, facture impayée, nouveau projet." /></TabsContent>
        <TabsContent value="backup" className="mt-6"><ComingSoon title="Sauvegarde" description="Sauvegardes automatiques et manuelles, restauration, export base de données." /></TabsContent>
        <TabsContent value="security" className="mt-6"><ComingSoon title="Sécurité" description="Mot de passe minimum, durée de session, 2FA, tentatives max, déconnexion auto." /></TabsContent>
        <TabsContent value="logs" className="mt-6"><ComingSoon title="Journalisation" description="Activation des journaux, conservation, export." /></TabsContent>
        <TabsContent value="email" className="mt-6"><ComingSoon title="Configuration SMTP" description="Serveur, port, email, mot de passe, test d'envoi." /></TabsContent>
        <TabsContent value="ai" className="mt-6"><ComingSoon title="Assistant IA" description="Suggestions automatiques, prévisions de stock et de ventes." /></TabsContent>
      </Tabs>
    </div>
  );
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary">Bientôt disponible</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

/* ─────────── Company ─────────── */

function CompanyTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as CompanySettings | null;
    },
  });

  const [form, setForm] = useState<CompanySettings | null>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async (payload: CompanySettings) => {
      const { error } = await supabase.from("company_settings").update({
        company_name: payload.company_name,
        logo_url: payload.logo_url,
        address: payload.address,
        phone: payload.phone,
        email: payload.email,
        website: payload.website,
        ice: payload.ice,
        if_number: payload.if_number,
        rc: payload.rc,
        patente: payload.patente,
        currency: payload.currency,
        default_vat: payload.default_vat,
        default_language: payload.default_language,
      }).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Paramètres enregistrés"); qc.invalidateQueries({ queryKey: ["company_settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form) return <Card className="shadow-card p-6"><Loader2 className="h-4 w-4 animate-spin" /></Card>;

  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) => setForm({ ...form, [k]: v });

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Informations de l'entreprise</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Ces informations apparaissent sur les documents et factures.</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de l'entreprise *"><Input disabled={!isAdmin} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
        <Field label="Logo (URL)"><Input disabled={!isAdmin} value={form.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value || null)} placeholder="https://…" /></Field>
        <Field label="Adresse" className="sm:col-span-2"><Textarea rows={2} disabled={!isAdmin} value={form.address ?? ""} onChange={(e) => set("address", e.target.value || null)} /></Field>
        <Field label="Téléphone"><Input disabled={!isAdmin} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} /></Field>
        <Field label="Email"><Input disabled={!isAdmin} type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value || null)} /></Field>
        <Field label="Site web"><Input disabled={!isAdmin} value={form.website ?? ""} onChange={(e) => set("website", e.target.value || null)} placeholder="https://…" /></Field>
        <Field label="ICE"><Input disabled={!isAdmin} value={form.ice ?? ""} onChange={(e) => set("ice", e.target.value || null)} /></Field>
        <Field label="IF"><Input disabled={!isAdmin} value={form.if_number ?? ""} onChange={(e) => set("if_number", e.target.value || null)} /></Field>
        <Field label="RC"><Input disabled={!isAdmin} value={form.rc ?? ""} onChange={(e) => set("rc", e.target.value || null)} /></Field>
        <Field label="Patente"><Input disabled={!isAdmin} value={form.patente ?? ""} onChange={(e) => set("patente", e.target.value || null)} /></Field>
        <Field label="Devise">
          <Select disabled={!isAdmin} value={form.currency} onValueChange={(v) => set("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MAD">Dirham marocain (DH)</SelectItem>
              <SelectItem value="EUR">Euro (€)</SelectItem>
              <SelectItem value="USD">Dollar US ($)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="TVA par défaut (%)"><Input disabled={!isAdmin} type="number" min="0" max="100" step="0.01" value={form.default_vat} onChange={(e) => set("default_vat", Number(e.target.value))} /></Field>
        <Field label="Langue par défaut">
          <Select disabled={!isAdmin} value={form.default_language} onValueChange={(v) => set("default_language", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
}

/* ─────────── Personalization ─────────── */

function PersonalizationTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as CompanySettings | null;
    },
  });
  const [form, setForm] = useState<CompanySettings | null>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async (payload: CompanySettings) => {
      const { error } = await supabase.from("company_settings").update({
        theme: payload.theme,
        primary_color: payload.primary_color,
        date_format: payload.date_format,
        time_format: payload.time_format,
      }).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Préférences enregistrées"); qc.invalidateQueries({ queryKey: ["company_settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!form) return <Card className="shadow-card p-6"><Loader2 className="h-4 w-4 animate-spin" /></Card>;

  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) => setForm({ ...form, [k]: v });

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Personnalisation</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Apparence, thème et formats d'affichage.</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Thème">
          <Select disabled={!isAdmin} value={form.theme} onValueChange={(v) => set("theme", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Clair</SelectItem>
              <SelectItem value="dark">Sombre</SelectItem>
              <SelectItem value="system">Système</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Couleur principale">
          <div className="flex items-center gap-2">
            <input
              type="color"
              disabled={!isAdmin}
              value={form.primary_color}
              onChange={(e) => set("primary_color", e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background"
            />
            <Input disabled={!isAdmin} value={form.primary_color} onChange={(e) => set("primary_color", e.target.value)} />
          </div>
        </Field>
        <Field label="Format de date">
          <Select disabled={!isAdmin} value={form.date_format} onValueChange={(v) => set("date_format", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">31/12/2026</SelectItem>
              <SelectItem value="MM/DD/YYYY">12/31/2026</SelectItem>
              <SelectItem value="YYYY-MM-DD">2026-12-31</SelectItem>
              <SelectItem value="DD MMM YYYY">31 déc. 2026</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Format d'heure">
          <Select disabled={!isAdmin} value={form.time_format} onValueChange={(v) => set("time_format", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HH:mm">24h (14:30)</SelectItem>
              <SelectItem value="hh:mm A">12h (02:30 PM)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
}

/* ─────────── Types (catalogs) ─────────── */

function TypesTab({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Gérez les listes de référence utilisées dans l'application (catégories de produits, marques, unités de mesure). Ces valeurs alimentent automatiquement les listes déroulantes des formulaires.
      </p>
      <CatalogManager
        title="Catégories de produits"
        table="categories"
        columns={[{ key: "name", label: "Nom", required: true }, { key: "description", label: "Description" }]}
        isAdmin={isAdmin}
      />
      <CatalogManager
        title="Marques"
        table="brands"
        columns={[{ key: "name", label: "Nom", required: true }, { key: "description", label: "Description" }]}
        isAdmin={isAdmin}
      />
      <CatalogManager
        title="Unités de mesure"
        table="units"
        columns={[{ key: "name", label: "Nom", required: true }, { key: "symbol", label: "Symbole" }]}
        isAdmin={isAdmin}
      />
    </div>
  );
}

type Column = { key: string; label: string; required?: boolean };
type Row = { id: string; [k: string]: string | null };

function CatalogManager({
  title, table, columns, isAdmin,
}: { title: string; table: "categories" | "brands" | "units"; columns: Column[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const key = ["catalog", table];
  const { data = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from(table).select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const startNew = () => { setEditing({ id: "" }); setDraft({}); };
  const startEdit = (r: Row) => {
    setEditing(r);
    const d: Record<string, string> = {};
    columns.forEach((c) => { d[c.key] = (r[c.key] ?? "") as string; });
    setDraft(d);
  };
  const cancel = () => { setEditing(null); setDraft({}); };

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | null> = {};
      columns.forEach((c) => {
        const v = (draft[c.key] ?? "").trim();
        payload[c.key] = v === "" ? null : v;
      });
      const required = columns.filter((c) => c.required);
      for (const c of required) {
        if (!payload[c.key]) throw new Error(`${c.label} requis`);
      }
      if (editing?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from(table).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from(table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Enregistré"); qc.invalidateQueries({ queryKey: key }); cancel(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {isAdmin && !editing && (
          <Button size="sm" onClick={startNew}><Plus className="h-3.5 w-3.5" /> Ajouter</Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {editing && (
          <div className="border-b bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {columns.map((c) => (
                <Field key={c.key} label={`${c.label}${c.required ? " *" : ""}`}>
                  <Input
                    value={draft[c.key] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={cancel}>Annuler</Button>
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer
              </Button>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="p-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : data.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Aucune entrée pour le moment.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                {isAdmin && <TableHead className="w-24 text-end">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.key === "name" ? "font-medium" : "text-muted-foreground"}>
                      {(r[c.key] as string) || "—"}
                    </TableCell>
                  ))}
                  {isAdmin && (
                    <TableCell className="text-end">
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700"
                          onClick={() => { if (confirm(`Supprimer "${r.name}" ?`)) remove.mutate(r.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
