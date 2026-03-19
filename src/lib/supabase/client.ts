"use client";

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseCookieOptions,
  getSupabaseUrl,
} from "@/lib/supabase/shared";

let browserClient: SupabaseClient | null = null;

export function createBrowserClient() {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        isSingleton: true,
        cookieOptions: getSupabaseCookieOptions(),
        cookies: {
          encode: "tokens-only",
          getAll: () => [],
          setAll: () => {},
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  }

  return browserClient;
}
