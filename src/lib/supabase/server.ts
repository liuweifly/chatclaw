import { cookies } from "next/headers";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  sessionExpiresSoon,
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
  type SupabaseSession,
  type SupabaseUser,
} from "@/lib/supabase/shared";

type FilterValue = string | number | boolean | null;
type ServerClientOptions = {
  useServiceRole?: boolean;
};

function getServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return value;
}

function encodeFilterValue(value: FilterValue) {
  if (value === null) return "is.null";
  if (typeof value === "number" || typeof value === "boolean") {
    return `eq.${value}`;
  }
  return `eq.${value}`;
}

async function fetchUser(accessToken: string) {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: getSupabaseAnonKey(),
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SupabaseUser;
}

async function refreshSession(refreshToken: string) {
  const response = await fetch(
    `${getSupabaseUrl()}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: getSupabaseAnonKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as SupabaseSession & {
    session?: SupabaseSession;
  };
  return payload.session ?? payload;
}

async function authCookies() {
  const store = await cookies();
  return {
    accessToken: store.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value ?? null,
    refreshToken: store.get(SUPABASE_REFRESH_TOKEN_COOKIE)?.value ?? null,
  };
}

export async function getServerSession() {
  const { accessToken, refreshToken } = await authCookies();

  if (!accessToken && !refreshToken) {
    return null;
  }

  let user = accessToken ? await fetchUser(accessToken) : null;
  let session: SupabaseSession | null =
    accessToken && user
      ? {
          access_token: accessToken,
          refresh_token: refreshToken ?? "",
          expires_at: 0,
          expires_in: 0,
          token_type: "bearer",
          user,
        }
      : null;

  if ((!session || sessionExpiresSoon(session, 0)) && refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed) {
      user = refreshed.user ?? (await fetchUser(refreshed.access_token));
      if (user) {
        session = { ...refreshed, user };
      }
    }
  }

  return session;
}

export async function getServerUser() {
  const session = await getServerSession();
  return session?.user ?? null;
}

async function getDbAuth(options: ServerClientOptions) {
  if (options.useServiceRole) {
    const serviceRoleKey = getServiceRoleKey();
    return {
      useServiceKey: true,
      accessToken: serviceRoleKey,
    };
  }

  const session = await getServerSession();
  if (!session?.access_token) {
    throw new Error("Missing authenticated Supabase session");
  }

  return {
    useServiceKey: false,
    accessToken: session.access_token,
  };
}

async function serviceFetch(
  path: string,
  init: RequestInit = {},
  options: { useServiceKey?: boolean; accessToken?: string } = {}
) {
  const key = options.useServiceKey ? getServiceRoleKey() : getSupabaseAnonKey();
  const response = await fetch(`${getSupabaseUrl()}${path}`, {
    ...init,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function buildQuery(filters?: Record<string, FilterValue>, extra?: URLSearchParams) {
  const params = extra ?? new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      params.set(key, encodeFilterValue(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function createServerClient(clientOptions: ServerClientOptions = {}) {
  return {
    auth: {
      getUser: getServerUser,
      getSession: getServerSession,
    },
    db: {
      select: async <T>(
        table: string,
        options?: {
          columns?: string;
          filters?: Record<string, FilterValue>;
          order?: { column: string; ascending?: boolean };
          limit?: number;
          maybeSingle?: boolean;
        }
        ) => {
        const auth = await getDbAuth(clientOptions);
        const params = new URLSearchParams();
        params.set("select", options?.columns ?? "*");
        if (options?.order) {
          params.set(
            "order",
            `${options.order.column}.${options.order.ascending === false ? "desc" : "asc"}`
          );
        }
        if (typeof options?.limit === "number") {
          params.set("limit", String(options.limit));
        }
        try {
          return (await serviceFetch(
            `/rest/v1/${table}${buildQuery(options?.filters, params)}`,
            {
              headers: options?.maybeSingle
                ? { Accept: "application/vnd.pgrst.object+json" }
                : undefined,
            },
            auth
          )) as T;
        } catch (error) {
          if (
            options?.maybeSingle &&
            error instanceof Error &&
            error.message.includes("(406)")
          ) {
            return null as T;
          }
          throw error;
        }
      },
      insert: async <T>(
        table: string,
        value: unknown,
        options?: { onConflict?: string; upsert?: boolean }
      ) => {
        const auth = await getDbAuth(clientOptions);
        const params = new URLSearchParams();
        params.set("select", "*");
        if (options?.onConflict) {
          params.set("on_conflict", options.onConflict);
        }
        const prefer = options?.upsert
          ? "resolution=merge-duplicates,return=representation"
          : "return=representation";
        return (await serviceFetch(
          `/rest/v1/${table}${buildQuery(undefined, params)}`,
          {
            method: "POST",
            headers: { Prefer: prefer },
            body: JSON.stringify(value),
          },
          auth
        )) as T[];
      },
      update: async <T>(
        table: string,
        value: unknown,
        filters: Record<string, FilterValue>
      ) => {
        const auth = await getDbAuth(clientOptions);
        const params = new URLSearchParams();
        params.set("select", "*");
        return (await serviceFetch(
          `/rest/v1/${table}${buildQuery(filters, params)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(value),
          },
          auth
        )) as T[];
      },
      delete: async (table: string, filters: Record<string, FilterValue>) => {
        const auth = await getDbAuth(clientOptions);
        await serviceFetch(
          `/rest/v1/${table}${buildQuery(filters)}`,
          {
            method: "DELETE",
            headers: { Prefer: "return=minimal" },
          },
          auth
        );
      },
    },
    admin: {
      deleteUser: async (userId: string) => {
        const auth = await getDbAuth({ useServiceRole: true });
        await serviceFetch(
          `/auth/v1/admin/users/${userId}`,
          { method: "DELETE" },
          auth
        );
      },
    },
  };
}

export function createServiceRoleClient() {
  return createServerClient({ useServiceRole: true });
}
