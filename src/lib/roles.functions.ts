import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ENUM_ROLES = ["admin", "manager", "commercial", "warehouse", "accountant", "employee"];

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export const listRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("roles")
      .select("key, label, is_system, created_at")
      .order("is_system", { ascending: false })
      .order("label");
    if (error) throw error;
    return data ?? [];
  });

export const listPermissionsCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("permissions")
      .select("id, module, action, label")
      .order("module").order("action");
    if (error) throw error;
    return data ?? [];
  });

export const listRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("role_permissions")
      .select("role, permission_id");
    if (error) throw error;
    return data ?? [];
  });

export const createRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { label: string; permission_ids: string[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const label = data.label.trim();
    if (!label) throw new Error("Nom du rôle requis");
    let key = slugify(label);
    if (!key) throw new Error("Nom du rôle invalide");
    // Ensure uniqueness
    const { data: existing } = await supabaseAdmin.from("roles").select("key").ilike("key", `${key}%`);
    const taken = new Set((existing ?? []).map((r: any) => r.key));
    if (taken.has(key)) {
      let i = 2;
      while (taken.has(`${key}_${i}`)) i++;
      key = `${key}_${i}`;
    }
    const { error } = await supabaseAdmin.from("roles").insert({ key, label, is_system: false });
    if (error) throw new Error(error.message);
    if (data.permission_ids.length) {
      const rows = data.permission_ids.map((pid) => ({ role: key, permission_id: pid }));
      await supabaseAdmin.from("role_permissions").insert(rows);
    }
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "create_role", module: "users",
      entity_id: null, new_value: { key, label, perms: data.permission_ids.length },
    });
    return { key };
  });

export const renameRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; label: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin.from("roles").select("is_system").eq("key", data.key).maybeSingle();
    if (!role) throw new Error("Rôle introuvable");
    if (role.is_system) throw new Error("Impossible de renommer un rôle système");
    const { error } = await supabaseAdmin.from("roles").update({ label: data.label.trim() }).eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin.from("roles").select("is_system").eq("key", data.key).maybeSingle();
    if (!role) throw new Error("Rôle introuvable");
    if (role.is_system) throw new Error("Impossible de supprimer un rôle système");
    // Reassign users on this role to 'employee'
    await supabaseAdmin.from("user_roles").update({ role: "employee", role_key: "employee" }).eq("role_key", data.key);
    await supabaseAdmin.from("role_permissions").delete().eq("role", data.key);
    const { error } = await supabaseAdmin.from("roles").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "delete_role", module: "users", entity_id: null, new_value: { key: data.key },
    });
    return { ok: true };
  });

export const setRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { role: string; permission_ids: string[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.role === "admin") throw new Error("Les permissions du rôle Admin ne peuvent pas être modifiées");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("role_permissions").delete().eq("role", data.role);
    if (data.permission_ids.length) {
      const rows = data.permission_ids.map((pid) => ({ role: data.role, permission_id: pid }));
      const { error } = await supabaseAdmin.from("role_permissions").insert(rows);
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "update_role_permissions", module: "users",
      entity_id: null, new_value: { role: data.role, count: data.permission_ids.length },
    });
    return { ok: true };
  });

export { ENUM_ROLES };
