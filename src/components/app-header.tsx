import { useNavigate } from "@tanstack/react-router";
import { Bell, Languages, LogOut, Moon, Sun, User as UserIcon, Calendar, Package, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type Notif = { id: string; kind: "appointment" | "stock" | "order"; title: string; desc: string; to: string; at?: string };

function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ["notifications"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Notif[]> => {
      const out: Notif[] = [];
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

      const { data: apts } = await supabase
        .from("appointments")
        .select("id,title,start_at,status")
        .gte("start_at", now.toISOString())
        .lte("start_at", in24h.toISOString())
        .in("status", ["scheduled", "confirmed"])
        .order("start_at", { ascending: true })
        .limit(5);
      (apts ?? []).forEach((a: any) => out.push({
        id: `apt-${a.id}`, kind: "appointment", title: a.title,
        desc: new Date(a.start_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
        to: "/appointments", at: a.start_at,
      }));

      const { data: prods } = await supabase
        .from("products")
        .select("id,name,quantity,min_stock")
        .limit(50);
      (prods ?? [])
        .filter((p: any) => (p.quantity ?? 0) <= (p.min_stock ?? 0))
        .slice(0, 5)
        .forEach((p: any) => out.push({
          id: `stk-${p.id}`, kind: "stock", title: p.name,
          desc: `Stock bas : ${p.quantity ?? 0} restant`, to: "/products",
        }));

      const { data: orders } = await supabase
        .from("orders")
        .select("id,number,status,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);
      (orders ?? []).forEach((o: any) => out.push({
        id: `ord-${o.id}`, kind: "order", title: `Commande ${o.number}`,
        desc: "En attente de validation", to: "/orders", at: o.created_at,
      }));

      return out;
    },
  });
}

export function AppHeader() {
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useI18n();
  const { user, signOut, isAdmin } = useAuth();
  const nav = useNavigate();
  const { data: notifs = [] } = useNotifications(!!user);

  const initial = (user?.email ?? "?").charAt(0).toUpperCase();
  const count = notifs.length;

  const Icon = ({ kind }: { kind: Notif["kind"] }) => {
    if (kind === "appointment") return <Calendar className="h-4 w-4 text-primary" />;
    if (kind === "stock") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <Package className="h-4 w-4 text-emerald-500" />;
  };

  return (
    // A thinner, more transparent bar with a stronger blur: the content
    // scrolling underneath stays perceptible, which is what makes a sticky
    // header feel like glass rather than a lid.
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/70 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 md:px-4">
      <SidebarTrigger className="text-muted-foreground transition-colors duration-(--dur-fast) hover:text-foreground" />
      {/* Same words, different weighting: the product name now leads in the
          display face and the tagline recedes. */}
      <div className="ms-2 hidden text-sm text-muted-foreground md:block">
        <span className="font-display font-semibold text-foreground">{t("app_name")}</span> ·{" "}
        {t("app_tagline")}
      </div>

      <div className="ms-auto flex items-center gap-1">
        {/* size="icon" is kept for the 36px target, but the box widens so the
            icon and the language code stop crowding each other. */}
        <Button variant="ghost" size="icon" className="w-auto gap-1 px-2" onClick={() => setLang(lang === "fr" ? "ar" : "fr")} title="Langue">
          <Languages className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase">{lang}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle} title="Thème">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" title="Notifications">
              <Bell className="h-4 w-4" />
              {count > 0 && (
                // The ring in the header's own colour cuts the counter out of
                // the bell instead of letting the two shapes merge.
                <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-(--elev-1) ring-2 ring-background">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 overflow-hidden rounded-lg p-0 shadow-(--elev-3)">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-2.5">
              <div className="font-display text-sm font-semibold">Notifications</div>
              <Badge variant="secondary">{count}</Badge>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {count === 0 ? (
                // An empty state with a mark on it reads as "nothing to do",
                // where a bare line of grey text reads as "something failed".
                <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-sm text-muted-foreground">
                  <Bell className="h-5 w-5 opacity-40" />
                  Aucune notification
                </div>
              ) : (
                notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => nav({ to: n.to })}
                    // `text-start` instead of `text-left`, and the last row
                    // drops its rule so the list ends cleanly on the popover
                    // edge.
                    className="flex w-full items-start gap-3 border-b border-border/60 px-3 py-3 text-start transition-colors duration-(--dur-fast) last:border-b-0 hover:bg-accent/40"
                  >
                    <div className="mt-0.5"><Icon kind={n.kind} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{n.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{n.desc}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="ms-1 max-w-[14rem] gap-2 px-2">
              <Avatar className="h-7 w-7 ring-1 ring-border">
                <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">{initial}</AvatarFallback>
              </Avatar>
              {/* Long addresses used to stretch the header; it truncates now. */}
              <span className="hidden min-w-0 truncate text-sm font-normal md:inline">{user?.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-lg shadow-(--elev-3)">
            <DropdownMenuLabel className="flex items-center gap-2 font-normal">
              <UserIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{user?.email}</span>
              {isAdmin && <Badge variant="secondary" className="ms-auto shrink-0">Admin</Badge>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => { await signOut(); nav({ to: "/login" }); }}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="me-2 h-4 w-4" /> {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
