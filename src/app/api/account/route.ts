import { NextResponse } from "next/server";
import { resolveLocale } from "@/i18n/config";
import { createServerClient } from "@/lib/supabase/server";
import type {
  AccountPayload,
  ProfileRecord,
  SubscriptionRecord,
  SupabaseUser,
} from "@/lib/supabase/shared";

async function ensureProfile(user: SupabaseUser) {
  const supabase = createServerClient();
  const existing = await supabase.db.select<ProfileRecord | null>("profiles", {
    filters: { id: user.id },
    maybeSingle: true,
  });

  if (existing) {
    return existing;
  }

  const inserted = await supabase.db.insert<ProfileRecord>(
    "profiles",
    {
      id: user.id,
      email: user.email ?? null,
      name:
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email ??
        null,
      avatar_url:
        user.user_metadata?.avatar_url ??
        user.user_metadata?.picture ??
        null,
      locale: null,
    },
    {
      onConflict: "id",
      upsert: true,
    }
  );

  return inserted[0] ?? null;
}

async function loadAccount(user: SupabaseUser) {
  const supabase = createServerClient();
  const profile = await ensureProfile(user);
  const subscription = await supabase.db.select<SubscriptionRecord[]>("subscriptions", {
    filters: { user_id: user.id },
    order: { column: "updated_at", ascending: false },
    limit: 1,
  });

  return {
    profile,
    subscription: subscription[0] ?? null,
  };
}

export async function GET() {
  const supabase = createServerClient();
  const user = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await loadAccount(user);
  const payload: AccountPayload = {
    user,
    profile: account.profile,
    subscription: account.subscription,
  };

  return NextResponse.json(payload);
}

export async function PATCH(request: Request) {
  const supabase = createServerClient();
  const user = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    locale?: string;
    name?: string;
    avatar_url?: string | null;
  };

  const updates: Record<string, string | null> = {};
  if (typeof body.locale === "string") {
    updates.locale = resolveLocale(body.locale);
  }
  if (typeof body.name === "string") {
    updates.name = body.name;
  }
  if ("avatar_url" in body) {
    updates.avatar_url = body.avatar_url ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  await ensureProfile(user);
  await supabase.db.update("profiles", updates, { id: user.id });
  const account = await loadAccount(user);

  return NextResponse.json({
    user,
    profile: account.profile,
    subscription: account.subscription,
  } satisfies AccountPayload);
}

export async function DELETE() {
  const supabase = createServerClient();
  const user = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase.admin.deleteUser(user.id);
  return NextResponse.json({ ok: true });
}
