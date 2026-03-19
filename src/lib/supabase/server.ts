import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  getSupabaseAnonKey,
  getSupabaseCookieOptions,
  getSupabaseUrl,
  mergeSupabaseCookieOptions,
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
  return `eq.${value}`;
}

async function createAuthClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      encode: "tokens-only",
      getAll: () =>
        cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, mergeSupabaseCookieOptions(options));
          }
        } catch {
          // Server Components cannot always mutate cookies. Middleware handles refresh persistence.
        }
      },
    },
  });
}

async function getAuthContext() {
  const client = await createAuthClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return null;
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session?.access_token) {
    return null;
  }

  return {
    user,
    session,
  };
}

export async function getServerSession() {
  return (await getAuthContext())?.session ?? null;
}

export async function getServerUser() {
  return (await getAuthContext())?.user ?? null;
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
  const authContextPromise = getAuthContext();

  const getCachedAuthContext = async () => authContextPromise;

  const getCachedDbAuth = async () => {
    if (clientOptions.useServiceRole) {
      return {
        useServiceKey: true,
        accessToken: getServiceRoleKey(),
      };
    }

    const context = await getCachedAuthContext();
    if (!context?.session.access_token) {
      throw new Error("Missing authenticated Supabase session");
    }

    return {
      useServiceKey: false,
      accessToken: context.session.access_token,
    };
  };

  return {
    auth: {
      getUser: async () => (await getCachedAuthContext())?.user ?? null,
      getSession: async () => (await getCachedAuthContext())?.session ?? null,
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
        const auth = await getCachedDbAuth();
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
        const auth = await getCachedDbAuth();
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
        const auth = await getCachedDbAuth();
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
        const auth = await getCachedDbAuth();
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
        const serviceRoleClient = createSupabaseClient(
          getSupabaseUrl(),
          getServiceRoleKey(),
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          }
        );

        const { error } = await serviceRoleClient.auth.admin.deleteUser(userId);
        if (error) {
          throw error;
        }
      },
    },
  };
}

export function createServiceRoleClient() {
  return createServerClient({ useServiceRole: true });
}
