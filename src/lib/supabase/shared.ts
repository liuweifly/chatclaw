export const SUPABASE_ACCESS_TOKEN_COOKIE = "chatclaw-sb-access-token";
export const SUPABASE_REFRESH_TOKEN_COOKIE = "chatclaw-sb-refresh-token";
export const SUPABASE_SESSION_STORAGE_KEY = "chatclaw-supabase-session";

export interface SupabaseUserMetadata {
  avatar_url?: string;
  full_name?: string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: SupabaseUserMetadata;
  app_metadata?: Record<string, unknown>;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: SupabaseUser;
}

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

export function getSessionExpiry(session: Pick<SupabaseSession, "expires_at" | "access_token">) {
  if (session.expires_at) {
    return session.expires_at;
  }
  const payload = decodeJwtPayload(session.access_token);
  return typeof payload?.exp === "number" ? payload.exp : 0;
}

export function sessionExpiresSoon(
  session: Pick<SupabaseSession, "expires_at" | "access_token"> | null | undefined,
  bufferSeconds = 60
) {
  if (!session) return true;
  const expiry = getSessionExpiry(session);
  if (!expiry) return true;
  return expiry - Math.floor(Date.now() / 1000) <= bufferSeconds;
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

export function readSessionFromHash(hash: string) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresIn = Number(params.get("expires_in") || "3600");
  const tokenType = params.get("token_type") || "bearer";

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    token_type: tokenType,
    user: { id: "" },
  } satisfies SupabaseSession;
}
