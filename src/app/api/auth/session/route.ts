import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAnonKey,
  getSupabaseCookieOptions,
  getSupabaseUrl,
  mergeSupabaseCookieOptions,
} from "@/lib/supabase/shared";

function createResponseClient(request: NextRequest, response: NextResponse) {
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      encode: "tokens-only",
      getAll: () =>
        request.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, mergeSupabaseCookieOptions(options));
        }
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const supabase = createResponseClient(request, response);
  const body = (await request.json()) as {
    accessToken?: string;
    refreshToken?: string;
  };

  if (!body.accessToken || !body.refreshToken) {
    return NextResponse.json({ error: "Missing Supabase session" }, { status: 400 });
  }

  const { error } = await supabase.auth.setSession({
    access_token: body.accessToken,
    refresh_token: body.refreshToken,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const supabase = createResponseClient(request, response);

  await supabase.auth.signOut();

  return response;
}
