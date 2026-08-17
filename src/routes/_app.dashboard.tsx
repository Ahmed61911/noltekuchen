import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { Boxes, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

export type Period = "month" | "quarter" | "semester" | "year" | "all";

/** Début de la période, ou null pour « Total » (pas de borne). */
function periodStart(p: Period): Date | null {
  if (p === "all") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "month") d.setMonth(d.getMonth() - 1);
  if (p === "quarter") d.setMonth(d.getMonth() - 3);
  if (p === "semester") d.setMonth(d.getMonth() - 6);
  if (p === "year") d.setFullYear(d.getFullYear() - 1);
  return d;
}

/**
 * Granularité du graphe : un point par jour sur un mois deviendrait 365 points
 * sur un an, illisible. On agrège donc par jour / semaine / mois selon
 * l'étendue demandée.
 */
function granularity(p: Period): "day" | "week" | "month" {
  if (p === "month") return "day";
  if (p === "quarter") return "week";
  return "month";
}

/** Clé de regroupement d'une date selon la granularité. */
function bucketKey(iso: string, g: "day" | "week" | "month"): string {
  if (g === "month") return iso.slice(0, 7);          // AAAA-MM
  if (g === "day") return iso.slice(0, 10);           // AAAA-MM-JJ
  const d = new Date(iso);                            // début de semaine (lundi)
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

function useDashboardCharts() {
  return useQuery({
    queryKey: ["dashboard-charts"],
    queryFn: async () => {
      // 1. CA Mensuel
      const d12 = new Date();
      d12.setMonth(d12.getMonth() - 11);
      d12.setDate(1);
      d12.setHours(0,0,0,0);
      const { data: salesData } = await supabase.from("sales").select("sale_date, total_ttc").neq("status", "cancelled").gte("sale_date", d12.toISOString());
      const monthlyRev = new Map<string, number>();
      (salesData || []).forEach(s => {
        if (!s.sale_date) return;
        const m = s.sale_date.slice(0, 7);
        monthlyRev.set(m, (monthlyRev.get(m) || 0) + Number(s.total_ttc || 0));
      });
      const revenueChart = Array.from(monthlyRev.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total }));

      // 2. Devis par statut
      const { data: quotesData } = await supabase.from("quotes").select("status");
      const qStats = new Map<string, number>();
      (quotesData || []).forEach(q => {
        const st = q.status || "draft";
        qStats.set(st, (qStats.get(st) || 0) + 1);
      });
      const quotesChart = Array.from(qStats.entries()).map(([name, value]) => ({ name, value }));

      // 3. Commandes en cours
      const { data: ordersData } = await supabase.from("orders").select("status");
      const oStats = new Map<string, number>();
      (ordersData || []).forEach(o => {
        const st = o.status || "pending";
        oStats.set(st, (oStats.get(st) || 0) + 1);
      });
      const ordersChart = Array.from(oStats.entries()).map(([name, value]) => ({ name, value }));

      // 4. Évolution du stock
      const d6 = new Date();
      d6.setMonth(d6.getMonth() - 5);
      d6.setDate(1);
      d6.setHours(0,0,0,0);
      const { data: products } = await supabase.from("products").select("id, purchase_price, stock_quantity");
      const { data: movements } = await supabase.from("stock_movements").select("created_at, type, quantity, product_id").gte("created_at", d6.toISOString());
      
      const currentStock = new Map<string, number>();
      const prices = new Map<string, number>();
      (products || []).forEach(p => {
        currentStock.set(p.id, Number(p.stock_quantity) || 0);
        prices.set(p.id, Number(p.purchase_price) || 0);
      });
      let currentVal = 0;
      currentStock.forEach((qty, id) => { currentVal += qty * (prices.get(id) || 0); });

      const valMovs = new Map<string, number>();
      (movements || []).forEach(m => {
        if (!m.created_at) return;
        const mth = m.created_at.slice(0, 7);
        const p = prices.get(m.product_id) || 0;
        const q = Number(m.quantity) || 0;
        const isOut = ["out", "sale", "supplier_return", "damaged"].includes(m.type);
        const delta = isOut ? -q : q;
        valMovs.set(mth, (valMovs.get(mth) || 0) + delta * p);
      });

      const months = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toISOString().slice(0, 7));
      }
      months.sort();

      const stockChart = [];
      let runningVal = currentVal;
      for (let i = 5; i >= 0; i--) {
        const m = months[i];
        stockChart.unshift({ month: m, value: runningVal });
        runningVal -= (valMovs.get(m) || 0);
      }

      return { revenueChart, quotesChart, ordersChart, stockChart };
    }
  });
}

function useDashboardData(period: Period) {
  return useQuery({
    queryKey: ["dashboard", period],
    queryFn: async () => {
      const start = periodStart(period);

      // La borne de date est appliquée par la base, pas après coup. L'ancien
      // code prenait les 200 derniers mouvements toutes périodes confondues :
      // un filtre « année » n'aurait montré que ces 200 lignes.
      let q = supabase
        .from("stock_movements")
        .select("id,type,quantity,created_at,product_id,products(name)")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (start) q = q.gte("created_at", start.toISOString());

      // Le CA vient des ventes réelles (total_ttc), pas d'une estimation
      // mouvements × prix : c'est la même source que le graphe « CA Mensuel »,
      // donc les deux chiffres concordent enfin.
      let salesQ = supabase.from("sales").select("total_ttc,sale_date").neq("status", "cancelled");
      if (start) salesQ = salesQ.gte("sale_date", start.toISOString().slice(0, 10));

      // Avoirs clients de la période — ils réduisent le C.A.
      let returnsQ = supabase.from("returns").select("total_ttc,return_date").eq("type", "client").neq("status", "cancelled");
      if (start) returnsQ = returnsQ.gte("return_date", start.toISOString().slice(0, 10));

      const [products, movements, sales, returns] = await Promise.all([
        supabase.from("products").select("id,name,reference,stock_quantity,min_stock"),
        q,
        salesQ,
        returnsQ,
      ]);
      const prods = products.data ?? [];
      const movs = movements.data ?? [];

      const IN = ["in", "purchase", "customer_return", "inventory"];
      const OUT = ["out", "sale", "supplier_return", "damaged"];

      // Stock total = photo de l'instant : volontairement hors période.
      const totalStock = prods.reduce((s, p) => s + Number(p.stock_quantity ?? 0), 0);
      const stockIn = movs.filter((m) => IN.includes(m.type)).reduce((s, m) => s + Number(m.quantity), 0);
      const stockOut = movs.filter((m) => OUT.includes(m.type)).reduce((s, m) => s + Number(m.quantity), 0);
      const revenue =
        (sales.data ?? []).reduce((s, x) => s + Number(x.total_ttc ?? 0), 0) -
        (returns.data ?? []).reduce((s, x) => s + Number(x.total_ttc ?? 0), 0);

      const lowStock = prods.filter((p) => Number(p.stock_quantity) <= Number(p.min_stock)).slice(0, 6);

      // Agrégation par intervalle, en partant des mouvements réellement
      // présents pour que « Total » couvre l'historique complet.
      const g = granularity(period);
      const buckets = new Map<string, { in: number; out: number }>();
      movs.forEach((m) => {
        const k = bucketKey(m.created_at, g);
        const cur = buckets.get(k) ?? { in: 0, out: 0 };
        if (IN.includes(m.type)) cur.in += Number(m.quantity);
        if (OUT.includes(m.type)) cur.out += Number(m.quantity);
        buckets.set(k, cur);
      });
      const chart = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({
          date: g === "month" ? k.slice(2) : k.slice(5),
          in: v.in,
          out: v.out,
        }));

      // top produits sur la période
      const counts = new Map<string, { name: string; qty: number }>();
      movs.forEach((m) => {
        const name = (m.products as { name?: string } | null)?.name ?? "—";
        const cur = counts.get(m.product_id) ?? { name, qty: 0 };
        cur.qty += Number(m.quantity);
        counts.set(m.product_id, cur);
      });
      const top = [...counts.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

      const recent = movs.slice(0, 6);
      return { totalStock, stockIn, stockOut, revenue, lowStock, chart, top, recent };
    },
  });
}

const fmt = new Intl.NumberFormat("fr-FR");
const fmtMoney = (n: number) => {
  const v = Number(n) || 0;
  const sign = v < 0 ? "-" : "";
  const [intPart, decPart] = Math.abs(v).toFixed(2).split(".");
  return `${sign}${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${decPart} DH`;
};

function Stat({ icon: Icon, label, value, tone, delta }: { icon: typeof Boxes; label: string; value: string; tone: "primary" | "navy" | "success" | "info"; delta?: string }) {
  const tones = {
    primary: "bg-primary text-primary-foreground",
    navy: "bg-navy text-navy-foreground",
    success: "bg-success text-success-foreground",
    info: "bg-info text-info-foreground",
  } as const;
  return (
    <div>
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
    </div>
  );
}

const QUOTE_COLORS: Record<string, string> = {
  draft: "var(--color-slate-500, #64748b)",
  sent: "var(--color-blue-500, #3b82f6)",
  accepted: "var(--color-emerald-500, #10b981)",
  refused: "var(--color-rose-500, #f43f5e)",
  expired: "var(--color-amber-500, #f59e0b)",
};

function Dashboard() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>("month");
  const { data, isLoading } = useDashboardData(period);
  const { data: chartsData, isLoading: isLoadingCharts } = useDashboardCharts();

  const periodLabels: Record<Period, string> = {
    month: t("period_month"),
    quarter: t("period_quarter"),
    semester: t("period_semester"),
    year: t("period_year"),
    all: t("period_all"),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("dashboard")}</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de l'activité Nolte Küchen</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("period")}</span>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(periodLabels) as Period[]).map((p) => (
                <SelectItem key={p} value={p}>{periodLabels[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Boxes} label={t("total_stock")} value={fmt.format(data?.totalStock ?? 0)} tone="primary" delta={t("stock_total_hint")} />
        <Stat icon={TrendingUp} label={t("stock_in")} value={fmt.format(data?.stockIn ?? 0)} tone="success" delta={periodLabels[period]} />
        <Stat icon={TrendingDown} label={t("stock_out")} value={fmt.format(data?.stockOut ?? 0)} tone="navy" delta={periodLabels[period]} />
        <Stat icon={DollarSign} label={t("revenue")} value={fmtMoney(data?.revenue ?? 0)} tone="info" delta={periodLabels[period]} />

      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">{t("movements")} — {periodLabels[period]}</CardTitle>
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
              <AlertTriangle className="h-4 w-4 text-warning-foreground dark:text-warning" />
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
                    <div className={`grid h-8 w-8 place-items-center rounded-md ${m.type === "in" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground dark:bg-warning/15 dark:text-warning"}`}>
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

      <div className="grid gap-4 lg:grid-cols-2 mt-6">
        {/* 1. CA Mensuel */}
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">CA Mensuel</CardTitle></CardHeader>
          <CardContent className="h-72">
            {isLoadingCharts ? (
              <div className="h-full animate-pulse rounded-lg bg-muted/40" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData?.revenueChart ?? []}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} formatter={(val: number) => fmtMoney(val)} />
                  <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 2. Devis par statut */}
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Devis par statut</CardTitle></CardHeader>
          <CardContent className="h-72">
            {isLoadingCharts ? (
              <div className="h-full animate-pulse rounded-lg bg-muted/40" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Pie data={chartsData?.quotesChart ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {(chartsData?.quotesChart ?? []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={QUOTE_COLORS[entry.name] || "var(--color-primary)"} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 3. Commandes en cours */}
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Pipeline commandes</CardTitle></CardHeader>
          <CardContent className="h-72">
            {isLoadingCharts ? (
              <div className="h-full animate-pulse rounded-lg bg-muted/40" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartsData?.ordersChart ?? []} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} width={80} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 4. Évolution du stock total */}
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Valeur du stock</CardTitle></CardHeader>
          <CardContent className="h-72">
            {isLoadingCharts ? (
              <div className="h-full animate-pulse rounded-lg bg-muted/40" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartsData?.stockChart ?? []}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} formatter={(val: number) => fmtMoney(val)} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
