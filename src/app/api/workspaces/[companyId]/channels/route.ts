import { NextResponse } from "next/server";
import { getOwnedWorkspace } from "@/lib/agent-security";
import { listWorkspaceChannels, type WorkspaceChannelsResponse } from "@/lib/channel-server";
import { getServerUser } from "@/lib/supabase/server";

export async function GET(
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

  const channels = await listWorkspaceChannels(companyId, {
    hasDefaultAgent: Boolean(company.agent_id),
    request,
  });
  return NextResponse.json({ channels } satisfies WorkspaceChannelsResponse);
}
