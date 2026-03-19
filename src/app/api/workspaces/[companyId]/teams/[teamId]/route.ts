import { NextResponse } from "next/server";
import { getOwnedWorkspace } from "@/lib/agent-security";
import { createServerClient, getServerUser } from "@/lib/supabase/server";
import type {
  LobsterAgentRecord,
  LobsterTeamRecord,
} from "@/lib/supabase/shared";
import { mapLobsterTeamRecordToTeam } from "@/lib/workspace-metadata";

async function getOwnedTeam(userId: string, companyId: string, teamId: string) {
  const supabase = createServerClient();
  return supabase.db.select<LobsterTeamRecord | null>("lobster_teams", {
    filters: {
      id: teamId,
      user_id: userId,
      company_id: companyId,
    },
    maybeSingle: true,
  });
}

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ companyId: string; teamId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, teamId } = await context.params;
  const company = await getOwnedWorkspace(user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getOwnedTeam(user.id, companyId, teamId);
  if (!existing) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    agentIds?: string[];
  };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Missing team name" }, { status: 400 });
    }
    updates.name = trimmed;
  }

  if ("description" in body) {
    updates.description = body.description?.trim() || null;
  }

  if ("agentIds" in body) {
    const agentIds = Array.from(new Set((body.agentIds ?? []).filter(Boolean)));
    if (agentIds.length === 0) {
      return NextResponse.json({ error: "A team needs at least one agent" }, { status: 400 });
    }
    if (!(await assertOwnedAgentIds(user.id, companyId, agentIds))) {
      return NextResponse.json({ error: "Invalid team members" }, { status: 400 });
    }
    updates.agent_ids = agentIds;
  }

  const supabase = createServerClient();
  const updated = await supabase.db.update<LobsterTeamRecord>("lobster_teams", updates, {
    id: teamId,
    user_id: user.id,
    company_id: companyId,
  });

  return NextResponse.json({
    team: mapLobsterTeamRecordToTeam(updated[0]),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ companyId: string; teamId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, teamId } = await context.params;
  const company = await getOwnedWorkspace(user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getOwnedTeam(user.id, companyId, teamId);
  if (!existing) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const supabase = createServerClient();
  await supabase.db.delete("lobster_teams", {
    id: teamId,
    user_id: user.id,
    company_id: companyId,
  });

  return NextResponse.json({ ok: true });
}
