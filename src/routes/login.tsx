import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import kitchenImg from "@/assets/login-kitchen.png";
import logoSvg from "@/assets/nolte-logo.svg";



export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { t } = useI18n();
  const { signIn, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) nav({ to: "/dashboard" }); }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast.error(error);
    else { toast.success("Connecté"); nav({ to: "/dashboard" }); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <img src={kitchenImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/30 to-black/70" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <img src={logoSvg} alt="Nolte Küchen" className="h-14 w-auto self-start" />

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h2 className="font-display text-4xl font-semibold leading-tight">L'élégance allemande, gérée avec précision.</h2>
            <p className="mt-4 max-w-md text-white/85">
              Plateforme interne pour piloter le stock, les ventes, les rendez-vous et l'ensemble du back-office Nolte.
            </p>
          </motion.div>
          <div className="text-xs text-white/70">© Nolte Küchen — ERP Interne</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-soft">
          <CardContent className="p-8">
            <h1 className="font-display text-2xl font-semibold">{t("welcome_back")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Connectez-vous à votre espace.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full bg-gradient-primary text-primary-foreground shadow-elegant" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sign_in")}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Les comptes sont créés par un administrateur.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
