import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    // Handle OAuth callback tokens that the Lovable broker returns in the
    // URL hash (#access_token=...&refresh_token=...). The Supabase client
    // defaults to PKCE flow and does NOT auto-consume hash-style tokens,
    // so without this step the user lands on "/" with valid tokens in the
    // URL, no session, and ProtectedRoute kicks them back to /login.
    const consumeHashTokens = async (): Promise<boolean> => {
      if (typeof window === "undefined") return false;
      const hash = window.location.hash?.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      if (!hash) return false;
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) return false;
      try {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          console.error("[auth] setSession from hash failed", error);
          return false;
        }
        // Clean tokens out of the URL so they don't leak into history / referrers.
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState({}, document.title, cleanUrl);
        return true;
      } catch (e) {
        console.error("[auth] setSession from hash threw", e);
        return false;
      }
    };

    (async () => {
      await consumeHashTokens();
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Memoise `user` so its reference is stable across renders that don't
  // change the session — prevents downstream effects (e.g. useUserRole)
  // from re-running and refetching role/route data.
  const user = useMemo<User | null>(() => session?.user ?? null, [session]);
  const value = useMemo(
    () => ({ session, user, loading, signOut }),
    [session, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
