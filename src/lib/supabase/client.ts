"use client";

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseCookieOptions,
  getSupabaseUrl,
} from "@/lib/supabase/shared";

let browserClient: SupabaseClient | null = null;

type BrowserCookie = {
  name: string;
  value: string;
};

type BrowserCookieToSet = BrowserCookie & {
  options?: {
    domain?: string;
    maxAge?: number;
    path?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
  };
};

function readBrowserCookies() {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=");
      const name = separator >= 0 ? part.slice(0, separator) : part;
      const value = separator >= 0 ? part.slice(separator + 1) : "";

      return {
        name,
        value: decodeURIComponent(value),
      };
    });
}

function writeBrowserCookie({ name, value, options }: BrowserCookieToSet) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  parts.push(`Path=${options?.path ?? "/"}`);

  if (options?.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (typeof options?.maxAge === "number") {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options?.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options?.secure) {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
}

function isPkceCookie(name: string) {
  const pkceKey = `${getSupabaseCookieOptions().name}-code-verifier`;
  return name === pkceKey || name.startsWith(`${pkceKey}.`);
}

function createBrowserCookieBridge() {
  return {
    encode: "tokens-only" as const,
    getAll: () => readBrowserCookies().filter(({ name }) => isPkceCookie(name)),
    setAll: (cookiesToSet: BrowserCookieToSet[]) => {
      for (const cookie of cookiesToSet) {
        if (!isPkceCookie(cookie.name)) {
          continue;
        }

        writeBrowserCookie(cookie);
      }
    },
  };
}

export function createBrowserClient() {
  if (typeof window === "undefined") {
    throw new Error(
      "createBrowserClient() must only be called in the browser. Use createServerClient() during SSR."
    );
  }

  if (!browserClient) {
    browserClient = createSupabaseBrowserClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        isSingleton: true,
        cookieOptions: getSupabaseCookieOptions(),
        cookies: createBrowserCookieBridge() as never,
      }
    );
  }

  return browserClient;
}
