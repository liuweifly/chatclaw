import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type {
  LobsterAgentRecord,
  LobsterRecord,
  LobsterTeamRecord,
} from "@/lib/supabase/shared";
import {
  mapLobsterAgentRecordToAgent,
  mapLobsterRecordToCompany,
  mapLobsterTeamRecordToTeam,
} from "@/lib/workspace-metadata";

export async function GET() {
  const supabase = createServerClient();
  const user = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [lobsters, agents, teams] = await Promise.all([
    supabase.db.select<LobsterRecord[]>("lobsters", {
      filters: { user_id: user.id },
      order: { column: "created_at", ascending: false },
    }),
    supabase.db.select<LobsterAgentRecord[]>("lobster_agents", {
      filters: { user_id: user.id },
      order: { column: "created_at", ascending: true },
    }),
    supabase.db.select<LobsterTeamRecord[]>("lobster_teams", {
      filters: { user_id: user.id },
      order: { column: "created_at", ascending: true },
    }),
  ]);

  return NextResponse.json({
    companies: lobsters.map(mapLobsterRecordToCompany),
    agents: agents.map(mapLobsterAgentRecordToAgent),
    teams: teams.map(mapLobsterTeamRecordToTeam),
  });
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
    description?: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Missing workspace name" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const inserted = await supabase.db.insert<LobsterRecord>(
    "lobsters",
    {
      id: body.id ?? crypto.randomUUID(),
      user_id: user.id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      role: null,
      agent_id: null,
      status: "active",
      created_at: now,
      updated_at: now,
    }
  );

  return NextResponse.json({
    company: mapLobsterRecordToCompany(inserted[0]),
  });
}
