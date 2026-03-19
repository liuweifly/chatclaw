import type { CookieOptionsWithName } from "@supabase/ssr";
import type { Session, User } from "@supabase/supabase-js";

export const SUPABASE_AUTH_COOKIE_NAME = "chatclaw-sb-auth";
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

function shouldUseSecureCookies() {
  return process.env.NODE_ENV === "production";
}

export type SupabaseUser = User;
export type SupabaseSession = Session;

export interface ProfileRecord {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  locale: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan: "free" | "pro" | "team";
  status: string;
  creem_customer_id: string | null;
  creem_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface LobsterRecord {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  agent_id: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountPayload {
  user: SupabaseUser;
  profile: ProfileRecord | null;
  subscription: SubscriptionRecord | null;
}

export function getSupabaseCookieOptions(): CookieOptionsWithName {
  return {
    name: SUPABASE_AUTH_COOKIE_NAME,
    path: "/",
    maxAge: THIRTY_DAYS_IN_SECONDS,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    httpOnly: true,
  };
}

export function mergeSupabaseCookieOptions(
  overrides: Partial<CookieOptionsWithName> = {}
): CookieOptionsWithName {
  return {
    ...getSupabaseCookieOptions(),
    ...overrides,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    httpOnly: true,
  };
}

export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return value;
}

export function getSupabaseAnonKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return value;
}

export function decodeJwtPayload(token: string) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + "=".repeat(padLength);
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function pickUserName(user: SupabaseUser | null | undefined, profile?: ProfileRecord | null) {
  return (
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Operator"
  );
}

export function pickUserAvatar(user: SupabaseUser | null | undefined, profile?: ProfileRecord | null) {
  return (
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null
  );
}
