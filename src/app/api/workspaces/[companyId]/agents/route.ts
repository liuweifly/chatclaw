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

const MAX_AGENT_ID_LENGTH = 64;
const MAX_AUTO_ID_ATTEMPTS = 25;

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
  const slug =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "agent";

  return slug.slice(0, MAX_AGENT_ID_LENGTH).replace(/-+$/g, "") || "agent";
}

function createAgentIdCandidate(base: string, attempt: number) {
  if (attempt === 0) {
    return base;
  }

  const suffix = `-${attempt + 1}`;
  const maxBaseLength = Math.max(1, MAX_AGENT_ID_LENGTH - suffix.length);
  const trimmedBase = base.slice(0, maxBaseLength).replace(/-+$/g, "") || "agent";

  return `${trimmedBase}${suffix}`;
}

function isAgentIdConflict(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Supabase request failed (409)") &&
    error.message.includes('"code":"23505"') &&
    error.message.includes("lobster_agents_pkey")
  );
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
  const requestedAgentId = body.id?.trim();
  if (requestedAgentId && !isValidAgentId(requestedAgentId)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const baseAgentId = requestedAgentId || slugifyAgentId(name);
  const now = new Date().toISOString();
  let agentId = baseAgentId;
  let inserted: LobsterAgentRecord[] | null = null;

  for (let attempt = 0; attempt < (requestedAgentId ? 1 : MAX_AUTO_ID_ATTEMPTS); attempt += 1) {
    agentId = requestedAgentId || createAgentIdCandidate(baseAgentId, attempt);

    try {
      inserted = await supabase.db.insert<LobsterAgentRecord>("lobster_agents", {
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
      break;
    } catch (error) {
      if (!isAgentIdConflict(error)) {
        throw error;
      }

      if (requestedAgentId) {
        return NextResponse.json({ error: "Agent already exists" }, { status: 409 });
      }
    }
  }

  if (!inserted) {
    throw new Error("Could not generate a unique agent id");
  }

  try {
    await provisionAgentWorkspace({
      agentId,
      name,
      description,
      specialty,
    });
  } catch (error) {
    console.warn("Failed to provision agent workspace", {
      agentId,
      companyId,
      error,
    });
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
