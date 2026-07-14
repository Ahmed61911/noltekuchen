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
        <p className="text-sm text-muted-foreground">Préférences de l'application</p>
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
