import { NextResponse } from "next/server";
import {
  fetchRemoteGatewayAgents,
  getGatewayConfig,
  getLocalGatewayAgents,
} from "@/lib/gateway-config";
import { getServerUser } from "@/lib/supabase/server";

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

  return NextResponse.json({
    found: true,
    gateway: { url: gateway.url, token: gateway.token },
    agents,
  });
}
