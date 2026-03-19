"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type {
  AccountPayload,
  ProfileRecord,
  SubscriptionRecord,
  SupabaseSession,
  SupabaseUser,
} from "@/lib/supabase/shared";
import { resolveLocale } from "@/i18n/config";
import { useSetLocale } from "@/i18n/provider";

interface AuthContextValue {
  user: SupabaseUser | null;
  session: SupabaseSession | null;
  profile: ProfileRecord | null;
  subscription: SubscriptionRecord | null;
  loading: boolean;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ signedIn: boolean }>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  updateProfileLocale: (locale: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function stripAuthParams(url: URL) {
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  const setLocale = useSetLocale();
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = createBrowserClient();
    }

    return clientRef.current;
  }, []);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setSubscription(null);
  }, []);

  const persistSession = useCallback(async (nextSession: SupabaseSession | null) => {
    if (!nextSession?.access_token || !nextSession.refresh_token) {
      clearAuthState();
      return;
    }

    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: nextSession.access_token,
        refreshToken: nextSession.refresh_token,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Could not persist session");
    }

    setSession(nextSession);
    setUser(nextSession.user);
  }, [clearAuthState]);

  const refreshAccount = useCallback(async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 401) {
        clearAuthState();
      }
      return;
    }

    const payload = (await response.json()) as AccountPayload;
    setUser(payload.user);
    setProfile(payload.profile);
    setSubscription(payload.subscription);
    if (payload.profile?.locale === "en" || payload.profile?.locale === "zh") {
      setLocale(payload.profile.locale);
    }
  }, [clearAuthState, setLocale]);

  useEffect(() => {
    let mounted = true;
    const client = getClient();

    void (async () => {
      try {
        const url = new URL(window.location.href);
        const authCode = url.searchParams.get("code");

        if (authCode) {
          const { data, error } = await client.auth.exchangeCodeForSession(authCode);
          if (error) {
            throw error;
          }

          await persistSession(data.session);
          window.history.replaceState({}, document.title, stripAuthParams(url));
        }

        await refreshAccount();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [getClient, persistSession, refreshAccount]);

  const signInWithGoogle = useCallback(async (redirectTo = "/dashboard") => {
    const client = getClient();
    await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL(redirectTo, window.location.origin).toString(),
      },
    });
  }, [getClient]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const client = getClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    await persistSession(data.session);
    await refreshAccount();
  }, [getClient, persistSession, refreshAccount]);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const client = getClient();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) {
      throw error;
    }

    if (data.session) {
      await persistSession(data.session);
      await refreshAccount();
      return { signedIn: true };
    }

    try {
      await signInWithPassword(email, password);
      return { signedIn: true };
    } catch {
      return { signedIn: false };
    }
  }, [getClient, persistSession, refreshAccount, signInWithPassword]);

  const signOut = useCallback(async () => {
    const client = getClient();
    await client.auth.signOut().catch(() => null);
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    clearAuthState();
  }, [clearAuthState, getClient]);

  const updateProfileLocale = useCallback(async (locale: string) => {
    const nextLocale = resolveLocale(locale);
    setLocale(nextLocale);

    if (!user) {
      return;
    }

    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    });
    if (response.ok) {
      const payload = (await response.json()) as AccountPayload;
      setProfile(payload.profile);
      setSubscription(payload.subscription);
    }
  }, [setLocale, user]);

  const deleteAccount = useCallback(async () => {
    const client = getClient();
    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) {
      throw new Error("Could not delete account");
    }
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    await client.auth.signOut().catch(() => null);
    clearAuthState();
  }, [clearAuthState, getClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      subscription,
      loading,
      signInWithGoogle,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      refreshAccount,
      updateProfileLocale,
      deleteAccount,
    }),
    [
      deleteAccount,
      loading,
      profile,
      refreshAccount,
      session,
      signInWithGoogle,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      subscription,
      updateProfileLocale,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
