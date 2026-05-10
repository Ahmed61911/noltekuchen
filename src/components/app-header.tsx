import { useNavigate } from "@tanstack/react-router";
import { Bell, Languages, LogOut, Moon, Sun, User as UserIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function AppHeader() {
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useI18n();
  const { user, signOut, isAdmin } = useAuth();
  const nav = useNavigate();

  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md md:px-4">
      <SidebarTrigger className="text-muted-foreground" />
      <div className="ms-2 hidden text-sm text-muted-foreground md:block">
        {t("app_name")} · <span className="text-foreground">{t("app_tagline")}</span>
      </div>

      <div className="ms-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setLang(lang === "fr" ? "ar" : "fr")} title="Langue">
          <Languages className="h-4 w-4" />
          <span className="ms-1 text-xs font-medium uppercase">{lang}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle} title="Thème">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="relative" title="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="ms-1 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-gradient-primary text-xs text-primary-foreground">{initial}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm md:inline">{user?.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> {user?.email}
              {isAdmin && <Badge variant="secondary" className="ms-auto">Admin</Badge>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => { await signOut(); nav({ to: "/login" }); }}
              className="text-destructive"
            >
              <LogOut className="me-2 h-4 w-4" /> {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
