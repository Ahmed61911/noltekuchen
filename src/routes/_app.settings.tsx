import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Languages, Palette, Bell, Sun, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

type NotifPrefs = { stock: boolean; projects: boolean; appointments: boolean; orders: boolean };
const NOTIF_KEY = "notif_prefs";
const defaultNotif: NotifPrefs = { stock: true, projects: true, appointments: true, orders: true };

function SettingsPage() {
  const { lang, setLang, t } = useI18n();
  const { theme, toggle } = useTheme();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ company_name: "", logo_url: "", address: "", phone: "", email: "" });
  useEffect(() => {
    if (company) {
      setForm({
        company_name: company.company_name ?? "",
        logo_url: company.logo_url ?? "",
        address: company.address ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
      });
    }
  }, [company]);

  const saveCompany = useMutation({
    mutationFn: async () => {
      if (!company) {
        const { error } = await supabase.from("company_settings").insert({ singleton: true, ...form });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_settings").update(form).eq("id", company.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["company_settings"] });
    },
    onError: (e: any) => toast.error(e.message ?? t("error")),
  });

  const [notif, setNotif] = useState<NotifPrefs>(() => {
    if (typeof window === "undefined") return defaultNotif;
    try { return { ...defaultNotif, ...JSON.parse(localStorage.getItem(NOTIF_KEY) || "{}") }; }
    catch { return defaultNotif; }
  });
  const updateNotif = (k: keyof NotifPrefs, v: boolean) => {
    const next = { ...notif, [k]: v };
    setNotif(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    toast.success(t("saved"));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings")}</h1>
        <p className="text-sm text-muted-foreground">Préférences de l'application et informations de l'entreprise</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Languages className="h-4 w-4" /> Langue</CardTitle>
          <CardDescription>Choisir la langue de l'interface</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant={lang === "fr" ? "default" : "outline"} onClick={() => setLang("fr")}>Français</Button>
          <Button variant={lang === "ar" ? "default" : "outline"} onClick={() => setLang("ar")}>العربية</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" /> Apparence</CardTitle>
          <CardDescription>Thème visuel de l'interface</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant={theme === "light" ? "default" : "outline"} onClick={() => theme !== "light" && toggle()}>
            <Sun className="me-2 h-4 w-4" /> Clair
          </Button>
          <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => theme !== "dark" && toggle()}>
            <Moon className="me-2 h-4 w-4" /> Sombre
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Entreprise</CardTitle>
          <CardDescription>
            {isAdmin ? "Informations utilisées dans les documents (factures, devis...)" : "Seul un administrateur peut modifier ces informations"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nom</Label>
                  <Input id="company_name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} disabled={!isAdmin} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo (URL)</Label>
                  <Input id="logo_url" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} disabled={!isAdmin} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!isAdmin} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!isAdmin} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Textarea id="address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!isAdmin} />
              </div>
              {form.logo_url && (
                <div className="rounded-md border p-3">
                  <div className="mb-2 text-xs text-muted-foreground">Aperçu du logo</div>
                  <img src={form.logo_url} alt="Logo" className="h-16 object-contain" />
                </div>
              )}
              {isAdmin && (
                <div className="flex justify-end">
                  <Button onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending}>
                    {saveCompany.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                    {t("save")}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle>
          <CardDescription>Choisir les types d'alertes à recevoir</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { k: "stock" as const, label: "Alertes stock", desc: "Notifications de stock faible" },
            { k: "projects" as const, label: "Nouveaux projets", desc: "Création de nouveaux projets" },
            { k: "appointments" as const, label: "Rendez-vous", desc: "Rappels de rendez-vous à venir" },
            { k: "orders" as const, label: "Commandes", desc: "Nouvelles commandes en attente" },
          ].map((item) => (
            <div key={item.k} className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <Switch checked={notif[item.k]} onCheckedChange={(v) => updateNotif(item.k, v)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
