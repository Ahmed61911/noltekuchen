import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Boxes, ShoppingCart, Calendar,
  Truck, FileText, BarChart3, History, Users, Settings, ClipboardList, ShieldCheck, Warehouse, Shield,
  Kanban, PackageCheck, FileSignature, Undo2,
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
import logoDarkUrl from "@/assets/nolte-logo-dark.svg";

/**
 * v1.1a — one nav-item recipe, used by every entry including Settings.
 *
 * The active state in v1.0 was a pale orange fill and nothing else, which in a
 * seventeen-item navigation is easy to miss. It now carries three signals at
 * once: a brand-coloured rail on the inline-start edge, the tint, and a heavier
 * label — plus the icon itself turning orange. `before:start-0` (not `left-0`)
 * keeps the rail on the correct edge in Arabic.
 *
 * Height goes 32px -> 36px: an ERP nav is a target you hit dozens of times a
 * day, and the row gap tightens to compensate so the list stays the same length.
 */
const navItemClass =
  "relative h-9 gap-3 rounded-md font-medium text-sidebar-foreground/80 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-sidebar-accent/60 hover:text-sidebar-foreground [&>svg]:text-sidebar-foreground/55 before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-e-full before:bg-sidebar-primary before:opacity-0 before:transition-opacity before:duration-(--dur-fast) data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground data-[active=true]:before:opacity-100 data-[active=true]:[&>svg]:text-sidebar-primary";

/** Sections read as structure, not as more nav items: smaller, tracked out, quieter. */
const groupLabelClass =
  "h-7 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45";

/** A hairline + breathing room is enough to separate blocks; no boxes needed. */
const groupDividerClass = "mt-1 border-t border-sidebar-border/60 pt-3";

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
    
    { to: "/quotes", icon: FileSignature, label: "Devis", module: "sales" },
    { to: "/orders", icon: ClipboardList, label: "Commandes", module: "orders" },
    { to: "/sales", icon: ShoppingCart, label: t("sales"), module: "sales" },
    { to: "/returns", icon: Undo2, label: "Retours", module: null },
    { to: "/appointments", icon: Calendar, label: t("appointments"), module: null },
  ].filter((it) => !it.module || can(it.module, "view"));
  const ops = [
    { to: "/projects", icon: Kanban, label: "Projets", module: "projects" },
    
    { to: "/suppliers", icon: Truck, label: t("suppliers"), module: "suppliers" },
    { to: "/warehouses", icon: Warehouse, label: "Dépôts", module: "stock" },
    { to: "/documents", icon: FileText, label: t("documents"), module: null },
    { to: "/reports", icon: BarChart3, label: t("reports"), module: "reports" },
    { to: "/logs", icon: History, label: t("logs"), module: null },
  ].filter((it) => !it.module || can(it.module, "view"));

  const isActive = (p: string) => (p === "/" ? path === "/" : path.startsWith(p));

  return (
    <Sidebar collapsible="icon" side={lang === "ar" ? "right" : "left"} className="border-r">
      {/* h-14 matches the app header exactly, so the two border-b lines meet
          instead of missing each other by a few pixels at the top-start corner. */}
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border/70 p-2">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-md px-2 py-1 transition-colors duration-(--dur-fast) hover:bg-sidebar-accent/50 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          {collapsed ? (
            <>
              <img src={logoUrl} alt="Nolte Küchen" className="h-8 w-8 object-contain dark:hidden" />
              <img src={logoDarkUrl} alt="Nolte Küchen" className="h-8 w-8 object-contain hidden dark:block" />
            </>
          ) : (
            <div className="flex flex-col leading-tight">
              <img src={logoUrl} alt="Nolte Küchen" className="h-10 w-auto dark:hidden" />
              <img src={logoDarkUrl} alt="Nolte Küchen" className="h-10 w-auto hidden dark:block" />
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className={groupLabelClass}>Principal</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {main.map((it) => (
                <SidebarMenuItem key={it.to}>
                  <SidebarMenuButton asChild isActive={isActive(it.to)} className={navItemClass}>
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

        <SidebarGroup className={groupDividerClass}>
          {!collapsed && <SidebarGroupLabel className={groupLabelClass}>Opérations</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {ops.map((it) => (
                <SidebarMenuItem key={it.to}>
                  <SidebarMenuButton asChild isActive={isActive(it.to)} className={navItemClass}>
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
          <SidebarGroup className={groupDividerClass}>
            {!collapsed && <SidebarGroupLabel className={groupLabelClass}>Administration</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/users")} className={navItemClass}>
                    <Link to="/users" className="flex items-center gap-3">
                      <Users className="h-4 w-4" />
                      {!collapsed && <span>{t("users")}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/roles")} className={navItemClass}>
                    <Link to="/roles" className="flex items-center gap-3">
                      <Shield className="h-4 w-4" />
                      {!collapsed && <span>Rôles & permissions</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/audit")} className={navItemClass}>
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

      <SidebarFooter className="border-t border-sidebar-border/70">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")} className={navItemClass}>
              <Link to="/settings" className="flex items-center gap-3">
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
