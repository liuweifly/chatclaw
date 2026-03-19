import { NextResponse } from "next/server";
import { getOwnedWorkspace, isValidAgentId } from "@/lib/agent-security";
import { removeAgentWorkspace } from "@/lib/agent-workspace-server";
import { getServerUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { companyId, agentId } = await request.json();

    if (!companyId || !agentId) {
      return NextResponse.json(
        { error: "companyId and agentId are required" },
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

    await removeAgentWorkspace(agentId);

    return NextResponse.json({ ok: true });
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
