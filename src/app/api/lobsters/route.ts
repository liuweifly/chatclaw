import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { LobsterRecord } from "@/lib/supabase/shared";

export async function GET() {
  const supabase = createServerClient();
  const user = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lobsters = await supabase.db.select<LobsterRecord[]>("lobsters", {
    filters: { user_id: user.id },
    order: { column: "created_at", ascending: false },
  });

  return NextResponse.json({ lobsters });
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const user = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    role?: string | null;
    agentId?: string | null;
    status?: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Missing lobster name" }, { status: 400 });
  }

  const inserted = await supabase.db.insert<LobsterRecord>("lobsters", {
    ...(body.id ? { id: body.id } : {}),
    user_id: user.id,
    name: body.name.trim(),
    role: body.role ?? null,
    agent_id: body.agentId ?? null,
    status: body.status ?? "active",
  }, {
    onConflict: "id",
    upsert: true,
  });

  return NextResponse.json({ lobster: inserted[0] ?? null });
}
