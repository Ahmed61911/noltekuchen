import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Languages, Palette, Bell, Sun, Moon, KeyRound, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";

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

  // ---- Changement de mot de passe ----
  const { user } = useAuth();
  const confirm = useConfirm();
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const pwdTooShort = newPwd.length > 0 && newPwd.length < 8;
  const pwdMismatch = confirmPwd.length > 0 && newPwd !== confirmPwd;
  const canSubmitPwd =
    currentPwd.length > 0 && newPwd.length >= 8 && newPwd === confirmPwd && !pwdBusy;

  async function changePassword() {
    if (!user?.email) return;
    if (newPwd === currentPwd) {
      toast.error("Le nouveau mot de passe doit être différent de l'actuel");
      return;
    }
    const ok = await confirm({
      title: "Changer votre mot de passe ?",
      description:
        "Vous resterez connecté sur cet appareil, mais l'ancien mot de passe cessera immédiatement de fonctionner. Assurez-vous d'avoir noté le nouveau.",
      confirmLabel: "Changer le mot de passe",
    });
    if (!ok) return;

    setPwdBusy(true);
    try {
      // Supabase n'exige pas le mot de passe actuel pour en définir un nouveau.
      // On le revérifie donc explicitement : sans cela, une session laissée
      // ouverte sur un poste partagé suffirait à s'approprier le compte.
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPwd,
      });
      if (authErr) {
        toast.error("Mot de passe actuel incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Mot de passe modifié");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings")}</h1>
        <p className="text-sm text-muted-foreground">Préférences de l'application</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Sécurité</CardTitle>
          <CardDescription>Changer votre mot de passe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="cur-pwd">Mot de passe actuel</Label>
              <Input
                id="cur-pwd" type="password" autoComplete="current-password"
                value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
              <Input
                id="new-pwd" type="password" autoComplete="new-password"
                value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
              />
              <p className={`text-xs ${pwdTooShort ? "text-destructive" : "text-muted-foreground"}`}>
                8 caractères minimum.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfm-pwd">Confirmer le nouveau mot de passe</Label>
              <Input
                id="cfm-pwd" type="password" autoComplete="new-password"
                value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
              />
              {pwdMismatch && (
                <p className="text-xs text-destructive">Les deux mots de passe ne correspondent pas.</p>
              )}
            </div>
            <div>
              <Button onClick={changePassword} disabled={!canSubmitPwd}>
                {pwdBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Changer le mot de passe
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
