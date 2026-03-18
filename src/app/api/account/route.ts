import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type {
  AccountPayload,
  ProfileRecord,
  SubscriptionRecord,
} from "@/lib/supabase/shared";

async function loadAccount(userId: string) {
  const supabase = createServerClient();
  const profile = await supabase.db.select<ProfileRecord | null>("profiles", {
    filters: { id: userId },
    maybeSingle: true,
  });
  const subscription = await supabase.db.select<SubscriptionRecord[]>("subscriptions", {
    filters: { user_id: userId },
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

  const account = await loadAccount(user.id);
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
    updates.locale = body.locale;
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

  await supabase.db.update("profiles", updates, { id: user.id });
  const account = await loadAccount(user.id);

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
