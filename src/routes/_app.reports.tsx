import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, ShoppingCart, Receipt, Package, FileDown, FileText, Filter,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { toast } from "@/lib/notify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { pdfMoney, pdfText } from "@/lib/pdf-safe";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

const CURRENCY = "DH";
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n || 0);
const fmtMoney = (n: number) => `${fmt(n)} ${CURRENCY}`;
const monthKey = (d: string) => d.slice(0, 7);
const monthLabel = (k: string) => {
  const [y, m] = k.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", {
    month: "short", year: "2-digit",
  });
};

const PALETTE = [
  "hsl(var(--primary))",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

type SaleRow = {
  id: string; sale_number: string; sale_date: string; total_ttc: number;
  customer_id: string | null;
  customers: { name: string } | null;
  sale_items: {
    quantity: number; unit_price: number; line_total_ttc: number;
    product_id: string | null;
    products: {
      id: string; name: string; reference: string; purchase_price: number;
      category_id: string | null;
      categories: { id: string; name: string } | null;
    } | null;
  }[];
};

function ReportsPage() {
  const today = new Date();
  const firstOfYear = new Date(today.getFullYear(), 0, 1);
  const [dateFrom, setDateFrom] = useState(firstOfYear.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [productId, setProductId] = useState<string>("all");
  const [customerId, setCustomerId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");

  const { data: customers = [] } = useQuery({
    queryKey: ["reports", "customers"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id,name").order("name");
      return data ?? [];
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["reports", "products-list"],
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("id,name,reference,stock_quantity,selling_price,purchase_price,category_id")
        .order("name");
      return data ?? [];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["reports", "categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name").order("name");
      return data ?? [];
    },
  });

  const { data: sales = [], isLoading } = useQuery<SaleRow[]>({
    queryKey: ["reports", "sales", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id, sale_number, sale_date, total_ttc, customer_id,
          customers ( name ),
          sale_items (
            quantity, unit_price, line_total_ttc, product_id,
            products ( id, name, reference, purchase_price, category_id,
              categories ( id, name ) )
          )
        `)
        .gte("sale_date", dateFrom)
        .lte("sale_date", dateTo)
        .order("sale_date", { ascending: true });
      if (error) throw error;
      return (data as unknown as SaleRow[]) ?? [];
    },
  });

  const { data: invoiceStats } = useQuery({
    queryKey: ["reports", "invoices", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id,total_ttc,status,invoice_date")
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo);
      const rows = data ?? [];
      return {
        paid: rows.filter((r) => r.status === "paid").length,
        total: rows.length,
      };
    },
  });

  const { data: stockMovements = [] } = useQuery({
    queryKey: ["reports", "stock-movements", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_movements")
        .select("type,quantity,created_at")
        .gte("created_at", dateFrom)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at");
      return data ?? [];
    },
  });

  // Filter sales by selected filters
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (customerId !== "all" && s.customer_id !== customerId) return false;
      if (productId !== "all" && !s.sale_items.some((it) => it.product_id === productId)) return false;
      if (categoryId !== "all" && !s.sale_items.some((it) => it.products?.category_id === categoryId)) return false;
      return true;
    });
  }, [sales, customerId, productId, categoryId]);

  // KPIs
  const kpis = useMemo(() => {
    const totalCA = filteredSales.reduce((a, s) => a + Number(s.total_ttc || 0), 0);
    const thisMonth = today.toISOString().slice(0, 7);
    const monthCA = filteredSales
      .filter((s) => monthKey(s.sale_date) === thisMonth)
      .reduce((a, s) => a + Number(s.total_ttc || 0), 0);
    const stockCount = products.reduce((a, p) => a + Number(p.stock_quantity || 0), 0);
    return {
      totalCA, monthCA, stockCount,
      paidInvoices: invoiceStats?.paid ?? 0,
      totalInvoices: invoiceStats?.total ?? 0,
    };
  }, [filteredSales, products, invoiceStats, today]);

  // Sales by month
  const salesByMonth = useMemo(() => {
    const map = new Map<string, number>();
    filteredSales.forEach((s) => {
      const k = monthKey(s.sale_date);
      map.set(k, (map.get(k) || 0) + Number(s.total_ttc || 0));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ month: monthLabel(k), value: Math.round(v) }));
  }, [filteredSales]);

  // Stock evolution (cumulative net movements per month)
  const stockByMonth = useMemo(() => {
    const map = new Map<string, number>();
    stockMovements.forEach((m) => {
      const k = monthKey(m.created_at);
      const delta = m.type === "in" ? Number(m.quantity) : -Number(m.quantity);
      map.set(k, (map.get(k) || 0) + delta);
    });
    let cum = 0;
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        cum += v;
        return { month: monthLabel(k), value: cum };
      });
  }, [stockMovements]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredSales.forEach((s) => {
      s.sale_items.forEach((it) => {
        const cat = it.products?.categories?.name || "Sans catégorie";
        map.set(cat, (map.get(cat) || 0) + Number(it.line_total_ttc || 0));
      });
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  // Top 10 products + performance table
  const performance = useMemo(() => {
    const map = new Map<string, {
      id: string; name: string; reference: string; quantity: number;
      revenue: number; cost: number;
    }>();
    filteredSales.forEach((s) => {
      s.sale_items.forEach((it) => {
        if (!it.products) return;
        const key = it.products.id;
        const cur = map.get(key) || {
          id: key, name: it.products.name, reference: it.products.reference,
          quantity: 0, revenue: 0, cost: 0,
        };
        cur.quantity += Number(it.quantity || 0);
        cur.revenue += Number(it.line_total_ttc || 0);
        cur.cost += Number(it.quantity || 0) * Number(it.products.purchase_price || 0);
        map.set(key, cur);
      });
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, margin: r.revenue - r.cost }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  const top10 = performance.slice(0, 10);

  const resetFilters = () => {
    setDateFrom(firstOfYear.toISOString().slice(0, 10));
    setDateTo(today.toISOString().slice(0, 10));
    setProductId("all"); setCustomerId("all"); setCategoryId("all");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      performance.map((p) => ({
        Référence: p.reference, Produit: p.name, Quantité: p.quantity,
        "CA HT": p.revenue, Coût: p.cost, Marge: p.margin,
      })),
    ), "Performances");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesByMonth), "Ventes par mois");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categoryBreakdown), "Par catégorie");
    XLSX.writeFile(wb, `rapport-${dateFrom}_${dateTo}.xlsx`);
    toast.success("Export Excel généré");
  };

  const exportPdf = () => {
    // pdfMoney / pdfText, pas fmtMoney : les polices standard de jsPDF
    // encodent en WinAnsi et ne connaissent ni U+202F (le séparateur de
    // milliers de Intl.NumberFormat("fr-FR"), qui sortait « 504/260 ») ni
    // « → » (qui sortait « !' »). À l'écran, fmtMoney reste correct.
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(pdfText("Rapport — Nolte Küchen"), 14, 18);
    doc.setFontSize(10);
    doc.text(pdfText(`Période : ${dateFrom} - ${dateTo}`), 14, 25);
    doc.text(
      pdfText(`CA total : ${pdfMoney(kpis.totalCA)}   |   Ventes mois : ${pdfMoney(kpis.monthCA)}`),
      14, 32,
    );
    autoTable(doc, {
      startY: 40,
      head: [["Référence", "Produit", "Qté", "CA HT", "Marge"].map(pdfText)],
      body: performance.map((p) => [
        pdfText(p.reference), pdfText(p.name), pdfText(p.quantity),
        pdfMoney(p.revenue), pdfMoney(p.margin),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
    });
    doc.save(`rapport-${dateFrom}_${dateTo}.pdf`);
    toast.success("Export PDF généré");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Rapports</h1>
          <p className="text-sm text-muted-foreground">
            Vue d'ensemble des performances commerciales et logistiques
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <FileDown className="h-4 w-4" /> Export Excel
          </Button>
          <Button variant="outline" onClick={exportPdf}>
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> Filtres
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          <div>
            <Label className="text-xs">Du</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Au</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Client</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Produit</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Catégorie</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" className="w-full" onClick={resetFilters}>Réinitialiser</Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Chiffre d'affaires total"
          value={fmtMoney(kpis.totalCA)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="from-primary/15 to-primary/5 text-primary"
        />
        <KpiCard
          label="Ventes du mois"
          value={fmtMoney(kpis.monthCA)}
          icon={<ShoppingCart className="h-5 w-5" />}
          tone="from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400"
        />
        <KpiCard
          label="Factures payées"
          value={`${kpis.paidInvoices} / ${kpis.totalInvoices}`}
          icon={<Receipt className="h-5 w-5" />}
          tone="from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          label="Produits en stock"
          value={fmt(kpis.stockCount)}
          icon={<Package className="h-5 w-5" />}
          tone="from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-card">
          <div className="mb-4">
            <h3 className="font-semibold">Évolution des ventes</h3>
            <p className="text-xs text-muted-foreground">Chiffre d'affaires mensuel TTC</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByMonth}>
                <defs>
                  <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
                    borderRadius: 8, fontSize: 12,
                  }}
                  formatter={(v: number) => fmtMoney(v)}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))"
                  strokeWidth={2} fill="url(#gradSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="mb-4">
            <h3 className="font-semibold">Évolution du stock</h3>
            <p className="text-xs text-muted-foreground">Variation cumulée des mouvements</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stockByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
                    borderRadius: 8, fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2}
                  dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-card">
          <div className="mb-4">
            <h3 className="font-semibold">Ventes par catégorie</h3>
            <p className="text-xs text-muted-foreground">Répartition du CA</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="value" nameKey="name"
                  innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
                    borderRadius: 8, fontSize: 12,
                  }}
                  formatter={(v: number) => fmtMoney(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="mb-4">
            <h3 className="font-semibold">Top 10 produits</h3>
            <p className="text-xs text-muted-foreground">Par chiffre d'affaires</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="name" width={120}
                  stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
                    borderRadius: 8, fontSize: 12,
                  }}
                  formatter={(v: number) => fmtMoney(v)}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Performance table */}
      <Card className="shadow-card">
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h3 className="font-semibold">Performances produits</h3>
            <p className="text-xs text-muted-foreground">
              {performance.length} produits vendus dans la période
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantité vendue</TableHead>
                <TableHead className="text-right">Chiffre d'affaires</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Marge %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Chargement…
                </TableCell></TableRow>
              ) : performance.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Aucune donnée pour la période sélectionnée
                </TableCell></TableRow>
              ) : performance.map((p) => {
                const pct = p.revenue > 0 ? (p.margin / p.revenue) * 100 : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">{fmt(p.quantity)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(p.revenue)}</TableCell>
                    <TableCell className={`text-right font-medium ${p.margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {fmtMoney(p.margin)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {pct.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function KpiCard({
  label, value, icon, tone,
}: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card className={`relative overflow-hidden p-5 shadow-card bg-gradient-to-br ${tone}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-background/60 backdrop-blur">
          {icon}
        </div>
      </div>
    </Card>
  );
}
