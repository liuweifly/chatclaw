import { NextResponse } from "next/server";
import { provisionAgentWorkspace } from "@/lib/agent-workspace-server";
import { getOwnedWorkspace, isValidAgentId } from "@/lib/agent-security";
import { createServerClient, getServerUser } from "@/lib/supabase/server";
import type {
  LobsterAgentRecord,
  LobsterRecord,
} from "@/lib/supabase/shared";
import { mapLobsterAgentRecordToAgent } from "@/lib/workspace-metadata";
import type { AgentSpecialty } from "@/types";

function normalizeSpecialty(value: unknown): AgentSpecialty {
  switch (value) {
    case "coding":
    case "research":
    case "writing":
    case "design":
    case "general":
      return value;
    default:
      return "general";
  }
}

function slugifyAgentId(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "agent"
  );
}

function createUniqueAgentId(base: string, existingIds: Set<string>) {
  let next = base;
  let counter = 2;

  while (existingIds.has(next)) {
    next = `${base}-${counter}`;
    counter += 1;
  }

  return next;
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
    specialty?: AgentSpecialty;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing agent name" }, { status: 400 });
  }

  const specialty = normalizeSpecialty(body.specialty);
  const description = body.description?.trim() || "";
  const supabase = createServerClient();
  const existingAgents = await supabase.db.select<Pick<LobsterAgentRecord, "id">[]>(
    "lobster_agents",
    {
      columns: "id",
      filters: { user_id: user.id },
    }
  );
  const requestedAgentId = body.id?.trim();
  if (requestedAgentId && !isValidAgentId(requestedAgentId)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  if (requestedAgentId && existingAgents.some((agent) => agent.id === requestedAgentId)) {
    return NextResponse.json({ error: "Agent already exists" }, { status: 409 });
  }

  const agentId = createUniqueAgentId(
    requestedAgentId || slugifyAgentId(name),
    new Set(existingAgents.map((agent) => agent.id))
  );
  const now = new Date().toISOString();

  const inserted = await supabase.db.insert<LobsterAgentRecord>("lobster_agents", {
    id: agentId,
    user_id: user.id,
    company_id: companyId,
    name,
    avatar_url: null,
    description,
    specialty,
    created_at: now,
    updated_at: now,
  });

  try {
    await provisionAgentWorkspace({
      agentId,
      name,
      description,
      specialty,
    });
  } catch (error) {
    await supabase.db.delete("lobster_agents", {
      id: agentId,
      user_id: user.id,
      company_id: companyId,
    });
    throw error;
  }

  if (!company.agent_id) {
    await supabase.db.update<LobsterRecord>(
      "lobsters",
      {
        agent_id: agentId,
        updated_at: now,
      },
      {
        id: companyId,
        user_id: user.id,
      }
    );
  }

  return NextResponse.json({
    agent: mapLobsterAgentRecordToAgent(inserted[0]),
  });
}
