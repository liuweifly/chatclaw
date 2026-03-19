"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { useSetLocale } from "@/i18n/provider";

interface AuthContextValue {
  user: SupabaseUser | null;
  session: SupabaseSession | null;
  profile: ProfileRecord | null;
  subscription: SubscriptionRecord | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  updateProfileLocale: (locale: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createBrowserClient(), []);
  const setLocale = useSetLocale();
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAccount = useCallback(async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 401) {
        setProfile(null);
        setSubscription(null);
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
  }, [setLocale]);

  useEffect(() => {
    let mounted = true;

    void client.initialize().then(async (nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        await refreshAccount();
      }
      setLoading(false);
    });

    const authSubscription = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void refreshAccount();
      } else {
        setProfile(null);
        setSubscription(null);
      }
    });

    return () => {
      mounted = false;
      authSubscription.data.subscription.unsubscribe();
    };
  }, [client, refreshAccount]);

  const signInWithGoogle = useCallback(async () => {
    await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/?workspace=1`,
      },
    });
  }, [client]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    await client.auth.signInWithPassword({ email, password });
    await refreshAccount();
  }, [client, refreshAccount]);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    await client.auth.signUp({ email, password });
    await refreshAccount();
  }, [client, refreshAccount]);

  const signOut = useCallback(async () => {
    await client.auth.signOut();
    setProfile(null);
    setSubscription(null);
  }, [client]);

  const updateProfileLocale = useCallback(async (locale: string) => {
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    if (response.ok) {
      const payload = (await response.json()) as AccountPayload;
      setProfile(payload.profile);
      setSubscription(payload.subscription);
      setLocale(locale === "zh" ? "zh" : "en");
    }
  }, [setLocale]);

  const deleteAccount = useCallback(async () => {
    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) {
      throw new Error("Could not delete account");
    }
    await client.auth.signOut();
  }, [client]);

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
