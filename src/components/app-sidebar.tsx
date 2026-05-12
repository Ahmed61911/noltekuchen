import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Boxes, ShoppingCart, Calendar,
  Truck, FileText, BarChart3, History, Users, Settings,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import logoUrl from "@/assets/nolte-logo.svg";

export function AppSidebar() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  const main = [
    { to: "/", icon: LayoutDashboard, label: t("dashboard") },
    { to: "/products", icon: Package, label: t("products") },
    { to: "/stock", icon: Boxes, label: t("stock") },
    { to: "/sales", icon: ShoppingCart, label: t("sales") },
    { to: "/appointments", icon: Calendar, label: t("appointments") },
  ];
  const ops = [
    { to: "/suppliers", icon: Truck, label: t("suppliers") },
    { to: "/customers", icon: Users, label: t("customers") },
    { to: "/documents", icon: FileText, label: t("documents") },
    { to: "/reports", icon: BarChart3, label: t("reports") },
    { to: "/logs", icon: History, label: t("logs") },
  ];

  const isActive = (p: string) => (p === "/" ? path === "/" : path.startsWith(p));

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <Link to="/" className="flex items-center gap-3 px-2 py-2.5">
          {collapsed ? (
            <img src={logoUrl} alt="Nolte Küchen" className="h-7 w-7 object-contain dark:invert" />
          ) : (
            <div className="flex flex-col leading-tight">
              <img src={logoUrl} alt="Nolte Küchen" className="h-6 w-auto dark:invert" />
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
