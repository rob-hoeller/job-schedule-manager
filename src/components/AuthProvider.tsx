"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

interface AuthContext {
  user: User | null;
  displayName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthContext>({
  user: null,
  displayName: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthCtx);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      if (u) fetchDisplayName(u.id);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchDisplayName(u.id);
      else setDisplayName(null);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchDisplayName(userId: string) {
    const { data } = await supabase
      .from("user_profiles")
      .select("display_name")
      .eq("id", userId)
      .single();
    setDisplayName(data?.display_name ?? null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setDisplayName(null);
    window.location.href = "/login";
  }

  return (
    <AuthCtx.Provider value={{ user, displayName, loading, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}
