import { NextResponse } from "next/server";
import { getOwnedWorkspace, isValidAgentId } from "@/lib/agent-security";
import { provisionAgentWorkspace } from "@/lib/agent-workspace-server";
import { getServerUser } from "@/lib/supabase/server";
import type { AgentSpecialty } from "@/types";

export async function POST(request: Request) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { companyId, agentId, name, description, specialty } = await request.json();

    if (!companyId || !agentId || !name) {
      return NextResponse.json(
        { error: "companyId, agentId, and name are required" },
        { status: 400 }
      );
    }

    if (!isValidAgentId(agentId)) {
      return NextResponse.json({ error: "Invalid agentId" }, { status: 400 });
    }

    const ownedWorkspace = await getOwnedWorkspace(user.id, companyId);
    if (!ownedWorkspace) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { workspaceDir } = await provisionAgentWorkspace({
      agentId,
      name,
      description: typeof description === "string" ? description : "",
      specialty:
        specialty === "coding" ||
        specialty === "research" ||
        specialty === "writing" ||
        specialty === "design" ||
        specialty === "general"
          ? (specialty as AgentSpecialty)
          : "general",
    });

    return NextResponse.json({ ok: true, workspace: workspaceDir });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Invalid agentId"
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown error";
    const status = message === "Invalid agentId" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
