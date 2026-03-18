import { NextResponse, type NextRequest } from "next/server";
import {
  decodeJwtPayload,
  getSupabaseAnonKey,
  getSupabaseUrl,
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
} from "@/lib/supabase/shared";

function tokenExpired(token: string | undefined | null, bufferSeconds = 60) {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (typeof payload?.exp !== "number") return true;
  return payload.exp - Math.floor(Date.now() / 1000) <= bufferSeconds;
}

async function refreshAccessToken(refreshToken: string) {
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

  return response.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const accessToken = request.cookies.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(SUPABASE_REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken || !tokenExpired(accessToken)) {
    return response;
  }

  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed) {
    response.cookies.delete(SUPABASE_ACCESS_TOKEN_COOKIE);
    response.cookies.delete(SUPABASE_REFRESH_TOKEN_COOKIE);
    return response;
  }

  response.cookies.set(SUPABASE_ACCESS_TOKEN_COOKIE, refreshed.access_token, {
    path: "/",
    sameSite: "lax",
    maxAge: refreshed.expires_in,
  });
  response.cookies.set(SUPABASE_REFRESH_TOKEN_COOKIE, refreshed.refresh_token, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
