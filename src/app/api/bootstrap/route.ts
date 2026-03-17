import { NextResponse } from "next/server";
import {
  fetchRemoteGatewayAgents,
  getGatewayConfig,
  getLocalGatewayAgents,
} from "@/lib/gateway-config";

export async function GET() {
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
