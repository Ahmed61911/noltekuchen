import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import nolteLogo from "@/assets/nolte-logo.svg";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const { t } = useI18n();
  const { signUp, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) nav({ to: "/dashboard" }); }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) toast.error(error);
    else { toast.success("Compte créé"); nav({ to: "/dashboard" }); }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-subtle p-6">
      <Card className="w-full max-w-md shadow-soft">
        <CardContent className="p-8">
          <div className="flex flex-col items-start gap-3">
            <img src={nolteLogo} alt="Nolte Küchen" className="h-9 w-auto dark:invert" />
            <div>
              <h1 className="font-display text-xl font-semibold">{t("create_account_title")}</h1>
              <p className="text-xs text-muted-foreground">ERP Interne</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">{t("full_name")}</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">8 caractères minimum</p>
            </div>
            <Button type="submit" className="w-full bg-gradient-primary text-primary-foreground shadow-elegant" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sign_up")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("has_account")} <Link to="/login" className="font-medium text-primary hover:underline">{t("sign_in")}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
