import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { Boxes, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [products, movements] = await Promise.all([
        supabase.from("products").select("id,name,reference,stock_quantity,min_stock,selling_price"),
        supabase.from("stock_movements")
          .select("id,type,quantity,created_at,product_id,products(name)")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      const prods = products.data ?? [];
      const movs = movements.data ?? [];

      const totalStock = prods.reduce((s, p) => s + (p.stock_quantity ?? 0), 0);
      const stockIn = movs.filter((m) => m.type === "in").reduce((s, m) => s + m.quantity, 0);
      const stockOut = movs.filter((m) => m.type === "out").reduce((s, m) => s + m.quantity, 0);
      const revenue = movs
        .filter((m) => m.type === "out")
        .reduce((s, m) => {
          const price = prods.find((p) => p.id === m.product_id)?.selling_price ?? 0;
          return s + Number(price) * m.quantity;
        }, 0);

      const lowStock = prods.filter((p) => p.stock_quantity <= p.min_stock).slice(0, 6);

      // 30-day buckets
      const days = Array.from({ length: 30 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return d.toISOString().slice(0, 10);
      });
      const chart = days.map((day) => {
        const dayMovs = movs.filter((m) => m.created_at.slice(0, 10) === day);
        return {
          date: day.slice(5),
          in: dayMovs.filter((m) => m.type === "in").reduce((s, m) => s + m.quantity, 0),
          out: dayMovs.filter((m) => m.type === "out").reduce((s, m) => s + m.quantity, 0),
        };
      });

      // top products by movement count
      const counts = new Map<string, { name: string; qty: number }>();
      movs.forEach((m) => {
        const name = (m.products as { name?: string } | null)?.name ?? "—";
        const cur = counts.get(m.product_id) ?? { name, qty: 0 };
        cur.qty += m.quantity;
        counts.set(m.product_id, cur);
      });
      const top = [...counts.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

      const recent = movs.slice(0, 6);
      return { totalStock, stockIn, stockOut, revenue, lowStock, chart, top, recent };
    },
  });
}

const fmt = new Intl.NumberFormat("fr-FR");
const fmtMoney = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function Stat({ icon: Icon, label, value, tone, delta }: { icon: typeof Boxes; label: string; value: string; tone: "primary" | "navy" | "success" | "info"; delta?: string }) {
  const tones = {
    primary: "bg-primary text-primary-foreground",
    navy: "bg-navy text-navy-foreground",
    success: "bg-success text-success-foreground",
    info: "bg-info text-info-foreground",
  } as const;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className={`overflow-hidden border-0 shadow-card transition-shadow hover:shadow-soft ${tones[tone]}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Icon className="h-6 w-6" />
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
              {delta && <p className="mt-1 text-xs opacity-80">{delta}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Dashboard() {
  const { t } = useI18n();
  const { data, isLoading } = useDashboardData();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de l'activité Nolte Küchen</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Boxes} label={t("total_stock")} value={fmt.format(data?.totalStock ?? 0)} accent="bg-primary/10 text-primary" />
        <Stat icon={TrendingUp} label={t("stock_in")} value={fmt.format(data?.stockIn ?? 0)} accent="bg-success/15 text-success" />
        <Stat icon={TrendingDown} label={t("stock_out")} value={fmt.format(data?.stockOut ?? 0)} accent="bg-warning/15 text-warning" />
        <Stat icon={DollarSign} label={t("revenue")} value={fmtMoney.format(data?.revenue ?? 0)} accent="bg-accent text-accent-foreground" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">{t("movements_30d")}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="h-full animate-pulse rounded-lg bg-muted/40" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.chart}>
                  <defs>
                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-warning)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-warning)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="in" stroke="var(--color-primary)" fill="url(#gIn)" strokeWidth={2} />
                  <Area type="monotone" dataKey="out" stroke="var(--color-warning)" fill="url(#gOut)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {t("low_stock_alerts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.lowStock ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune alerte 🎉</p>
            )}
            {data?.lowStock.map((p) => (
              <Link
                to="/products"
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.reference}</p>
                </div>
                <Badge variant="destructive" className="ms-2">{p.stock_quantity}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">{t("top_products")}</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.top ?? []} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} width={110} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="qty" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">{t("recent_activity")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data?.recent ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("no_data")}</p>}
              {data?.recent.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`grid h-8 w-8 place-items-center rounded-md ${m.type === "in" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {m.type === "in" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {(m.products as { name?: string } | null)?.name ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={m.type === "in" ? "secondary" : "outline"}>
                    {m.type === "in" ? "+" : "−"}{m.quantity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
