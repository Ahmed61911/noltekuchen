import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

function Stub({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Construction className="h-6 w-6" />
          </div>
          <p className="font-medium">Module en préparation</p>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/customers")({
  component: () => <Stub title="Demandes clients" desc="Suivi et historique" />,
});
