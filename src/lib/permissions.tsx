import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type PermAction = "view" | "create" | "update" | "delete" | "export" | "print";

export function usePermissions() {
  const { user, isAdmin } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["user_permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.rpc("get_user_permissions", { _user_id: user.id });
      return (data ?? []) as { module: string; action: string; allowed: boolean }[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const map = new Map<string, boolean>();
  data.forEach((r) => map.set(`${r.module}:${r.action}`, r.allowed));

  function can(module: string, action: PermAction | string = "view"): boolean {
    if (isAdmin) return true;
    return map.get(`${module}:${action}`) ?? false;
  }

  return { can, isAdmin };
}
