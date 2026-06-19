import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/audit-log";

type Role = "admin" | "employee";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: Role[];
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentUid: string | null = null;
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      const newUid = s?.user?.id ?? null;
      if (newUid !== currentUid) {
        const prevUid = currentUid;
        currentUid = newUid;
        if (newUid) {
          setTimeout(() => loadRoles(newUid), 0);
          if (e === "SIGNED_IN") setTimeout(() => logAction({ action: "login", module: "auth", description: "Connexion" }), 0);
        } else {
          setRoles([]);
          if (prevUid && e === "SIGNED_OUT") {
            setTimeout(() => logAction({ action: "logout", module: "auth", description: "Déconnexion" }), 0);
          }
        }
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      const uid = data.session?.user?.id ?? null;
      if (uid && uid !== currentUid) {
        currentUid = uid;
        loadRoles(uid);
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRoles(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data?.map((r) => r.role) ?? []) as Role[]);
  }

  const signIn: AuthState["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp: AuthState["signUp"] = async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/` },
    });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthCtx.Provider
      value={{ user, session, loading, roles, isAdmin: roles.includes("admin"), signIn, signUp, signOut }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
