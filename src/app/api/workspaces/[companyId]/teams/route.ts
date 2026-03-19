import { NextResponse } from "next/server";
import { getOwnedWorkspace } from "@/lib/agent-security";
import { createServerClient, getServerUser } from "@/lib/supabase/server";
import type {
  LobsterAgentRecord,
  LobsterTeamRecord,
} from "@/lib/supabase/shared";
import { mapLobsterTeamRecordToTeam } from "@/lib/workspace-metadata";

async function assertOwnedAgentIds(userId: string, companyId: string, agentIds: string[]) {
  const supabase = createServerClient();
  const agents = await supabase.db.select<Pick<LobsterAgentRecord, "id">[]>("lobster_agents", {
    columns: "id",
    filters: {
      user_id: userId,
      company_id: companyId,
    },
  });

  const allowed = new Set(agents.map((agent) => agent.id));
  return agentIds.every((agentId) => allowed.has(agentId));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await context.params;
  const company = await getOwnedWorkspace(user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    description?: string;
    agentIds?: string[];
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing team name" }, { status: 400 });
  }

  const agentIds = Array.from(new Set((body.agentIds ?? []).filter(Boolean)));
  if (agentIds.length === 0) {
    return NextResponse.json({ error: "A team needs at least one agent" }, { status: 400 });
  }

  if (!(await assertOwnedAgentIds(user.id, companyId, agentIds))) {
    return NextResponse.json({ error: "Invalid team members" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const supabase = createServerClient();

  if (body.id?.trim()) {
    const existing = await supabase.db.select<Pick<LobsterTeamRecord, "id"> | null>(
      "lobster_teams",
      {
        columns: "id",
        filters: {
          id: body.id.trim(),
          user_id: user.id,
          company_id: companyId,
        },
        maybeSingle: true,
      }
    );
    if (existing) {
      return NextResponse.json({ error: "Team already exists" }, { status: 409 });
    }
  }

  const inserted = await supabase.db.insert<LobsterTeamRecord>("lobster_teams", {
    id: body.id?.trim() || crypto.randomUUID(),
    user_id: user.id,
    company_id: companyId,
    name,
    description: body.description?.trim() || null,
    agent_ids: agentIds,
    created_at: now,
    updated_at: now,
  });

  return NextResponse.json({
    team: mapLobsterTeamRecordToTeam(inserted[0]),
  });
}
