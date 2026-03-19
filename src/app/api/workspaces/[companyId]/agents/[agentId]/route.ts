import { NextResponse } from "next/server";
import {
  provisionAgentWorkspace,
  removeAgentWorkspace,
} from "@/lib/agent-workspace-server";
import { getOwnedWorkspace } from "@/lib/agent-security";
import { createServerClient, getServerUser } from "@/lib/supabase/server";
import type {
  LobsterAgentRecord,
  LobsterRecord,
  LobsterTeamRecord,
} from "@/lib/supabase/shared";
import { mapLobsterAgentRecordToAgent } from "@/lib/workspace-metadata";
import type { AgentSpecialty } from "@/types";

function normalizeSpecialty(value: unknown, fallback: AgentSpecialty): AgentSpecialty {
  switch (value) {
    case "coding":
    case "research":
    case "writing":
    case "design":
    case "general":
      return value;
    default:
      return fallback;
  }
}

async function getOwnedAgent(userId: string, companyId: string, agentId: string) {
  const supabase = createServerClient();
  return supabase.db.select<LobsterAgentRecord | null>("lobster_agents", {
    filters: {
      id: agentId,
      user_id: userId,
      company_id: companyId,
    },
    maybeSingle: true,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ companyId: string; agentId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, agentId } = await context.params;
  const company = await getOwnedWorkspace(user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getOwnedAgent(user.id, companyId, agentId);
  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    specialty?: AgentSpecialty;
  };

  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name;
  const description =
    typeof body.description === "string" ? body.description.trim() : existing.description;
  const specialty = normalizeSpecialty(body.specialty, normalizeSpecialty(existing.specialty, "general"));

  await provisionAgentWorkspace({
    agentId,
    name,
    description,
    specialty,
  });

  const supabase = createServerClient();
  const updated = await supabase.db.update<LobsterAgentRecord>(
    "lobster_agents",
    {
      name,
      description,
      specialty,
      updated_at: new Date().toISOString(),
    },
    {
      id: agentId,
      user_id: user.id,
      company_id: companyId,
    }
  );

  return NextResponse.json({
    agent: mapLobsterAgentRecordToAgent(updated[0]),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ companyId: string; agentId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, agentId } = await context.params;
  const company = await getOwnedWorkspace(user.id, companyId);
  if (!company) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await getOwnedAgent(user.id, companyId, agentId);
  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const supabase = createServerClient();
  const [agents, teams] = await Promise.all([
    supabase.db.select<LobsterAgentRecord[]>("lobster_agents", {
      filters: {
        user_id: user.id,
        company_id: companyId,
      },
    }),
    supabase.db.select<LobsterTeamRecord[]>("lobster_teams", {
      filters: {
        user_id: user.id,
        company_id: companyId,
      },
    }),
  ]);

  const now = new Date().toISOString();
  const fallbackAgentId =
    agents.find((agent) => agent.id !== agentId)?.id ?? null;

  for (const team of teams) {
    if (!team.agent_ids.includes(agentId)) {
      continue;
    }

    await supabase.db.update<LobsterTeamRecord>(
      "lobster_teams",
      {
        agent_ids: team.agent_ids.filter((entry) => entry !== agentId),
        updated_at: now,
      },
      {
        id: team.id,
        user_id: user.id,
        company_id: companyId,
      }
    );
  }

  await removeAgentWorkspace(agentId);
  await supabase.db.delete("lobster_agents", {
    id: agentId,
    user_id: user.id,
    company_id: companyId,
  });

  if (company.agent_id === agentId) {
    await supabase.db.update<LobsterRecord>(
      "lobsters",
      {
        agent_id: fallbackAgentId,
        updated_at: now,
      },
      {
        id: companyId,
        user_id: user.id,
      }
    );
  }

  return NextResponse.json({ ok: true });
}
