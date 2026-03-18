"use client";

import {
  getSessionExpiry,
  getSupabaseAnonKey,
  getSupabaseUrl,
  readSessionFromHash,
  sessionExpiresSoon,
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
  SUPABASE_SESSION_STORAGE_KEY,
  type SupabaseSession,
  type SupabaseUser,
} from "@/lib/supabase/shared";

type AuthChangeEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED";

type AuthListener = (event: AuthChangeEvent, session: SupabaseSession | null) => void;

interface AuthResponse {
  session: SupabaseSession | null;
  user: SupabaseUser | null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function loadStoredSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SUPABASE_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SupabaseSession;
  } catch {
    return null;
  }
}

function persistSession(session: SupabaseSession | null) {
  if (typeof window === "undefined") return;

  if (!session) {
    window.localStorage.removeItem(SUPABASE_SESSION_STORAGE_KEY);
    clearCookie(SUPABASE_ACCESS_TOKEN_COOKIE);
    clearCookie(SUPABASE_REFRESH_TOKEN_COOKIE);
    return;
  }

  window.localStorage.setItem(SUPABASE_SESSION_STORAGE_KEY, JSON.stringify(session));
  const maxAge = Math.max(getSessionExpiry(session) - Math.floor(Date.now() / 1000), 0);
  setCookie(SUPABASE_ACCESS_TOKEN_COOKIE, session.access_token, maxAge);
  setCookie(
    SUPABASE_REFRESH_TOKEN_COOKIE,
    session.refresh_token,
    60 * 60 * 24 * 30
  );
}

async function requestAuth<T>(path: string, init: RequestInit) {
  const response = await fetch(`${getSupabaseUrl()}${path}`, {
    ...init,
    headers: {
      apikey: getSupabaseAnonKey(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { msg?: string; error_description?: string; error?: string }
      | null;
    throw new Error(
      errorBody?.msg ||
        errorBody?.error_description ||
        errorBody?.error ||
        `Supabase auth request failed (${response.status})`
    );
  }

  return (await response.json()) as T;
}

class BrowserSupabaseClient {
  private session: SupabaseSession | null = loadStoredSession();
  private listeners = new Set<AuthListener>();

  auth = {
    getSession: async () => ({ data: { session: this.session } }),
    signInWithOAuth: async ({
      provider,
      options,
    }: {
      provider: "google";
      options?: { redirectTo?: string };
    }) => {
      const redirectTo =
        options?.redirectTo || `${window.location.origin}/?workspace=1`;
      const url = new URL(`${getSupabaseUrl()}/auth/v1/authorize`);
      url.searchParams.set("provider", provider);
      url.searchParams.set("redirect_to", redirectTo);
      window.location.href = url.toString();
      return { data: null, error: null };
    },
    signInWithPassword: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const data = await requestAuth<AuthResponse>("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      this.setSession(data.session, "SIGNED_IN");
      return { data, error: null };
    },
    signUp: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const data = await requestAuth<AuthResponse>("/auth/v1/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (data.session) {
        this.setSession(data.session, "SIGNED_IN");
      }
      return { data, error: null };
    },
    signOut: async () => {
      const token = this.session?.access_token;
      if (token) {
        await fetch(`${getSupabaseUrl()}/auth/v1/logout`, {
          method: "POST",
          headers: {
            apikey: getSupabaseAnonKey(),
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => null);
      }
      this.setSession(null, "SIGNED_OUT");
      return { error: null };
    },
    refreshSession: async () => {
      if (!this.session?.refresh_token) {
        this.setSession(null, "SIGNED_OUT");
        return { data: { session: null }, error: null };
      }

      const payload = await requestAuth<AuthResponse>(
        "/auth/v1/token?grant_type=refresh_token",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: this.session.refresh_token }),
        }
      );
      this.setSession(payload.session, "TOKEN_REFRESHED");
      return { data: payload, error: null };
    },
    getUser: async () => {
      const token = this.session?.access_token;
      if (!token) {
        return { data: { user: null } };
      }

      const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
        headers: {
          apikey: getSupabaseAnonKey(),
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.setSession(null, "SIGNED_OUT");
        }
        return { data: { user: null } };
      }

      const user = (await response.json()) as SupabaseUser;
      if (this.session) {
        this.setSession({ ...this.session, user }, "TOKEN_REFRESHED");
      }
      return { data: { user } };
    },
    onAuthStateChange: (callback: AuthListener) => {
      this.listeners.add(callback);
      callback("INITIAL_SESSION", this.session);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.listeners.delete(callback);
            },
          },
        },
      };
    },
    exchangeSessionFromUrl: async () => {
      const parsed = readSessionFromHash(window.location.hash);
      if (!parsed) {
        return { data: { session: null }, error: null };
      }

      const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
        headers: {
          apikey: getSupabaseAnonKey(),
          Authorization: `Bearer ${parsed.access_token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Could not load Supabase user after OAuth redirect.");
      }

      const user = (await response.json()) as SupabaseUser;
      this.setSession({ ...parsed, user }, "SIGNED_IN");
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${window.location.search}`
      );
      return { data: { session: this.session }, error: null };
    },
  };

  private setSession(session: SupabaseSession | null, event: AuthChangeEvent) {
    this.session = session;
    persistSession(session);

    for (const listener of this.listeners) {
      listener(event, session);
    }
  }

  async initialize() {
    if (typeof window === "undefined") {
      return null;
    }

    if (window.location.hash.includes("access_token")) {
      await this.auth.exchangeSessionFromUrl();
    }

    if (this.session && sessionExpiresSoon(this.session)) {
      try {
        await this.auth.refreshSession();
      } catch {
        this.setSession(null, "SIGNED_OUT");
      }
    } else if (this.session && !this.session.user?.id) {
      await this.auth.getUser();
    }

    return this.session;
  }
}

let browserClient: BrowserSupabaseClient | null = null;

export function createBrowserClient() {
  if (!browserClient) {
    browserClient = new BrowserSupabaseClient();
  }
  return browserClient;
}
