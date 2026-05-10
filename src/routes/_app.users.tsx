import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

function UsersPage() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !isAdmin) nav({ to: "/dashboard" });
  }, [loading, isAdmin, nav]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">Gestion des rôles et permissions</p>
      </div>
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Construction className="h-6 w-6" />
          </div>
          <p className="font-medium">Module administration en préparation</p>
        </CardContent>
      </Card>
    </div>
  );
}
