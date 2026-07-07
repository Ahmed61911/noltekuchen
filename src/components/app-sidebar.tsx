import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Boxes, ShoppingCart, Calendar,
  Truck, FileText, BarChart3, History, Users, Settings, Receipt, UserSquare, ClipboardList, ShieldCheck, Warehouse, Shield,
  FileSignature, Kanban, PackageCheck,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import logoUrl from "@/assets/nolte-logo.svg";

export function AppSidebar() {
  const { t, lang } = useI18n();
  const { isAdmin } = useAuth();
  const { can } = usePermissions();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  const main = [
    { to: "/", icon: LayoutDashboard, label: t("dashboard"), module: null },
    { to: "/products", icon: Package, label: t("products"), module: "products" },
    { to: "/stock", icon: Boxes, label: t("stock"), module: "stock" },
    { to: "/quotes", icon: FileSignature, label: "Devis", module: "quotes" },
    { to: "/orders", icon: ClipboardList, label: "Commandes", module: "orders" },
    { to: "/sales", icon: ShoppingCart, label: t("sales"), module: "sales" },
    { to: "/invoices", icon: Receipt, label: "Facturation", module: "sales" },
    { to: "/appointments", icon: Calendar, label: t("appointments"), module: null },
  ].filter((it) => !it.module || can(it.module, "view"));
  const ops = [
    { to: "/projects", icon: Kanban, label: "Projets", module: "projects" },
    { to: "/purchase-orders", icon: PackageCheck, label: "Commandes fournisseurs", module: "purchase_orders" },
    { to: "/suppliers", icon: Truck, label: t("suppliers"), module: "suppliers" },
    { to: "/customers", icon: UserSquare, label: "Clients", module: "customers" },
    { to: "/warehouses", icon: Warehouse, label: "Dépôts", module: "stock" },
    { to: "/documents", icon: FileText, label: t("documents"), module: null },
    { to: "/reports", icon: BarChart3, label: t("reports"), module: "reports" },
    { to: "/logs", icon: History, label: t("logs"), module: null },
  ].filter((it) => !it.module || can(it.module, "view"));

  const isActive = (p: string) => (p === "/" ? path === "/" : path.startsWith(p));

  return (
    <Sidebar collapsible="icon" side={lang === "ar" ? "right" : "left"} className="border-r">
      <SidebarHeader className="border-b">
        <Link to="/" className="flex items-center gap-3 px-2 py-2.5">
          {collapsed ? (
            <img src={logoUrl} alt="Nolte Küchen" className="h-7 w-7 object-contain" />
          ) : (
            <div className="flex flex-col leading-tight">
              <img src={logoUrl} alt="Nolte Küchen" className="h-6 w-auto" />
              <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{t("app_tagline")}</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Principal</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((it) => (
                <SidebarMenuItem key={it.to}>
                  <SidebarMenuButton asChild isActive={isActive(it.to)}>
                    <Link to={it.to} className="flex items-center gap-3">
                      <it.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{it.label}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Opérations</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {ops.map((it) => (
                <SidebarMenuItem key={it.to}>
                  <SidebarMenuButton asChild isActive={isActive(it.to)}>
                    <Link to={it.to} className="flex items-center gap-3">
                      <it.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{it.label}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Administration</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/users")}>
                    <Link to="/users" className="flex items-center gap-3">
                      <Users className="h-4 w-4" />
                      {!collapsed && <span>{t("users")}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/roles")}>
                    <Link to="/roles" className="flex items-center gap-3">
                      <Shield className="h-4 w-4" />
                      {!collapsed && <span>Rôles & permissions</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/audit")}>
                    <Link to="/audit" className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4" />
                      {!collapsed && <span>Journal d'audit</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/" className="flex items-center gap-3 text-muted-foreground">
                <Settings className="h-4 w-4" />
                {!collapsed && <span>{t("settings")}</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
