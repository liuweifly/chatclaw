import { NextResponse } from "next/server";
import { removeAgentWorkspace } from "@/lib/agent-workspace-server";
import { getOwnedWorkspace } from "@/lib/agent-security";
import { createServerClient, getServerUser } from "@/lib/supabase/server";
import type { LobsterAgentRecord, LobsterRecord } from "@/lib/supabase/shared";
import { mapLobsterRecordToCompany } from "@/lib/workspace-metadata";

async function getOwnedCompany(userId: string, companyId: string) {
  return getOwnedWorkspace(userId, companyId);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await context.params;
  const existing = await getOwnedCompany(user.id, companyId);
  if (!existing) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    defaultAgentId?: string | null;
  };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Missing workspace name" }, { status: 400 });
    }
    updates.name = trimmed;
  }

  if ("description" in body) {
    updates.description = body.description?.trim() || null;
  }

  if ("defaultAgentId" in body) {
    if (body.defaultAgentId) {
      const supabase = createServerClient();
      const defaultAgent = await supabase.db.select<LobsterAgentRecord | null>(
        "lobster_agents",
        {
          filters: {
            id: body.defaultAgentId,
            user_id: user.id,
            company_id: companyId,
          },
          maybeSingle: true,
        }
      );
      if (!defaultAgent) {
        return NextResponse.json({ error: "Invalid default agent" }, { status: 400 });
      }
    }
    updates.agent_id = body.defaultAgentId || null;
  }

  const supabase = createServerClient();
  const updated = await supabase.db.update<LobsterRecord>("lobsters", updates, {
    id: companyId,
    user_id: user.id,
  });

  return NextResponse.json({
    company: mapLobsterRecordToCompany(updated[0]),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await context.params;
  const existing = await getOwnedCompany(user.id, companyId);
  if (!existing) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServerClient();
  const agents = await supabase.db.select<LobsterAgentRecord[]>("lobster_agents", {
    filters: {
      user_id: user.id,
      company_id: companyId,
    },
  });

  for (const agent of agents) {
    try {
      await removeAgentWorkspace(agent.id);
    } catch {
      // Continue removing metadata even if filesystem cleanup is partial.
    }
  }

  await Promise.all([
    supabase.db.delete("lobster_teams", {
      user_id: user.id,
      company_id: companyId,
    }),
    supabase.db.delete("lobster_agents", {
      user_id: user.id,
      company_id: companyId,
    }),
  ]);

  await supabase.db.delete("lobsters", {
    id: companyId,
    user_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
