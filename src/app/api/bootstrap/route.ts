import { NextResponse } from "next/server";
import {
  fetchRemoteGatewayAgents,
  getGatewayConfig,
  getLocalGatewayAgents,
} from "@/lib/gateway-config";
import { createServerClient, getServerUser } from "@/lib/supabase/server";
import type { LobsterRecord } from "@/lib/supabase/shared";

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gateway = await getGatewayConfig();
  if (!gateway) {
    return NextResponse.json({ found: false });
  }

  const agents =
    gateway.source === "env"
      ? await fetchRemoteGatewayAgents(gateway.url, gateway.token)
      : await getLocalGatewayAgents();

  const supabase = createServerClient();
  const lobsters = await supabase.db.select<LobsterRecord[]>("lobsters", {
    filters: { user_id: user.id },
    order: { column: "created_at", ascending: false },
  });

  const gatewayAgentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const scopedAgents = lobsters.flatMap((lobster) => {
    const agentId = lobster.agent_id?.trim();
    if (!agentId) {
      return [];
    }

    const gatewayAgent = gatewayAgentsById.get(agentId);
    return [
      {
        id: agentId,
        name: gatewayAgent?.name ?? lobster.name,
      },
    ];
  });

  return NextResponse.json({
    found: true,
    gateway: {
      url: gateway.url,
      hasToken: true,
      source: gateway.source,
    },
    agents: scopedAgents,
  });
}
