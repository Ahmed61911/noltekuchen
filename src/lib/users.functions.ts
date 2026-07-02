import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CreateInput = {
  email: string;
  full_name: string;
  username?: string;
  phone?: string;
  department?: string;
  role: "admin" | "manager" | "commercial" | "warehouse" | "accountant" | "employee";
  password: string;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, username, phone, avatar_url, department, status, last_login_at, created_at");
    if (pErr) throw pErr;

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: usersResp } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const authMap = new Map(usersResp.users.map((u) => [u.id, u]));
    const roleMap = new Map<string, string>();
    (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));

    return (profiles ?? []).map((p: any) => {
      const auth = authMap.get(p.id);
      return {
        ...p,
        email: auth?.email ?? null,
        last_sign_in_at: auth?.last_sign_in_at ?? p.last_login_at,
        banned_until: (auth as any)?.banned_until ?? null,
        role: roleMap.get(p.id) ?? "employee",
      };
    });
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CreateInput) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    await supabaseAdmin.from("profiles").update({
      full_name: data.full_name,
      username: data.username ?? null,
      phone: data.phone ?? null,
      department: data.department ?? null,
    }).eq("id", uid);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const enumRole = ["admin","manager","commercial","warehouse","accountant","employee"].includes(data.role) ? data.role : "employee";
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: enumRole as any, role_key: data.role });

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "create_user", module: "users",
      entity_id: uid, new_value: { email: data.email, role: data.role },
    });
    return { id: uid };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; password: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "reset_password", module: "users", entity_id: data.user_id,
    });
    return { ok: true };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; status: "active" | "inactive" | "blocked" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ status: data.status }).eq("id", data.user_id);
    if (data.status === "blocked") {
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "876000h" } as any);
    } else {
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "none" } as any);
    }
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "set_status", module: "users",
      entity_id: data.user_id, new_value: { status: data.status },
    });
    return { ok: true };
  });

const ENUM_ROLES = new Set(["admin", "manager", "commercial", "warehouse", "accountant", "employee"]);

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: old } = await supabaseAdmin.from("user_roles").select("role, role_key").eq("user_id", data.user_id).maybeSingle();
    const enumRole = ENUM_ROLES.has(data.role) ? data.role : "employee";
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: enumRole as any, role_key: data.role });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "change_role", module: "users",
      entity_id: data.user_id, old_value: old, new_value: { role: data.role },
    });
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "delete_user", module: "users", entity_id: data.user_id,
    });
    return { ok: true };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; full_name?: string; username?: string; phone?: string; department?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { user_id, ...patch } = data;
    await supabaseAdmin.from("profiles").update(patch).eq("id", user_id);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId, action: "update_user", module: "users", entity_id: user_id, new_value: patch,
    });
    return { ok: true };
  });

export const setUserPermissionOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; permission_id: string; granted: boolean | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.granted === null) {
      await supabaseAdmin.from("user_permissions").delete()
        .eq("user_id", data.user_id).eq("permission_id", data.permission_id);
    } else {
      await supabaseAdmin.from("user_permissions").upsert(
        { user_id: data.user_id, permission_id: data.permission_id, granted: data.granted },
        { onConflict: "user_id,permission_id" }
      );
    }
    return { ok: true };
  });
