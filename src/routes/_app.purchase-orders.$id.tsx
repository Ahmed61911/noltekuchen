import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/purchase-orders/$id")({
  component: PODetail,
});

const CURRENCY = "DH";
const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n)} ${CURRENCY}`;

function PODetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["purchase_order", id],
    queryFn: async () => {
      const { data: po, error } = await supabase.from("purchase_orders").select("*, suppliers(*)").eq("id", id).single();
      if (error) throw error;
      const { data: items } = await supabase.from("purchase_order_items").select("*").eq("purchase_order_id", id);
      return { po, items: items ?? [] };
    },
  });

  if (isLoading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.po) return <div className="text-center py-20 text-muted-foreground">Commande introuvable</div>;
  const { po, items } = data;
  const supplier = (po as { suppliers?: { name: string; email: string | null; phone: string | null; address: string | null } }).suppliers ?? null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/purchase-orders"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{po.po_number}</h1>
          <Badge>{po.status}</Badge>
        </div>
      </div>
      <Card>
        <CardContent className="p-6 grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs uppercase text-muted-foreground mb-2">Fournisseur</p>
            {supplier ? (
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-base">{supplier.name}</p>
                {supplier.address && <p>{supplier.address}</p>}
                {supplier.email && <p className="text-muted-foreground">{supplier.email}</p>}
                {supplier.phone && <p className="text-muted-foreground">{supplier.phone}</p>}
              </div>
            ) : <p className="text-muted-foreground">—</p>}
          </div>
          <div className="md:text-right space-y-1 text-sm">
            <div className="flex md:justify-end gap-3"><span className="text-muted-foreground">Date :</span><span className="font-medium">{po.order_date}</span></div>
            <div className="flex md:justify-end gap-3"><span className="text-muted-foreground">Livraison :</span><span className="font-medium">{po.expected_date ?? "—"}</span></div>
            <div className="flex md:justify-end gap-3"><span className="text-muted-foreground">Reçue :</span><span className="font-medium">{po.received_date ?? "—"}</span></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qté</TableHead>
              <TableHead className="text-right">Prix d'achat</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(it => (
              <TableRow key={it.id}>
                <TableCell>{it.description}</TableCell>
                <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(it.unit_cost))}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(it.total))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-6 flex justify-end">
          <div className="w-full max-w-xs">
            <div className="flex justify-between border-t pt-2 font-semibold text-lg"><span>Total</span><span className="tabular-nums">{fmt(Number(po.total))}</span></div>
          </div>
        </div>
        {po.notes && <div className="p-6 pt-0"><p className="text-xs uppercase text-muted-foreground mb-1">Notes</p><p className="text-sm">{po.notes}</p></div>}
      </Card>
    </div>
  );
}
