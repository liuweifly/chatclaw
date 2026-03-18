import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/gateway-config";

export async function POST() {
  const gateway = await getGatewayConfig();

  if (!gateway || gateway.source !== "local") {
    return NextResponse.json(
      { error: "Remote gateway restart is disabled from ChatClaw." },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { error: "Local gateway restart is disabled in this deployment." },
    { status: 501 }
  );
}
