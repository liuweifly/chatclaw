import { NextResponse } from "next/server";
import { readLobsterChatHistory } from "@/lib/lobster-workspace-server";
import { getServerUser } from "@/lib/supabase/server";
import type { ChatTargetType } from "@/types";

function isValidTargetType(value: string | null): value is ChatTargetType {
  return value === "agent" || value === "team";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  const rawAgentIds = url.searchParams.get("agentIds");

  if (!isValidTargetType(targetType) || !targetId) {
    return NextResponse.json({ error: "Missing chat target" }, { status: 400 });
  }

  const { companyId } = await context.params;
  const history = await readLobsterChatHistory(user.id, companyId, {
    targetType,
    targetId,
    agentIds:
      targetType === "team"
        ? rawAgentIds
            ?.split(",")
            .map((value) => value.trim())
            .filter(Boolean) ?? []
        : undefined,
  });

  if (!history) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ history });
}
