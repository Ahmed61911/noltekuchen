import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "export"
  | "validate"
  | "view";

export type AuditModule =
  | "products"
  | "stock"
  | "orders"
  | "sales"
  | "invoices"
  | "suppliers"
  | "customers"
  | "documents"
  | "users"
  | "auth"
  | "reports"
  | "appointments"
  | "warehouses";

type LogParams = {
  action: AuditAction;
  module: AuditModule;
  entity_id?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  description?: string;
};

/** Insère un log dans audit_logs. N'échoue jamais (best-effort). */
export async function logAction(p: LogParams): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const user_id = u.user?.id ?? null;
    if (!user_id) return;
    const new_value = p.description
      ? { ...(p.new_value ?? {}), description: p.description }
      : p.new_value ?? null;
    await supabase.from("audit_logs").insert({
      user_id,
      action: p.action,
      module: p.module,
      entity_id: p.entity_id ?? null,
      old_value: (p.old_value ?? null) as never,
      // Was fetched from api.ipify.org on every session: an external call from
      // each staff member's browser, for a self-reported value that is
      // trivially spoofed. Nginx already logs the real client IP.
      ip_address: null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    /* silencieux */
  }
}
