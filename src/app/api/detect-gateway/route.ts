import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/gateway-config";

export async function GET() {
  const config = await getGatewayConfig();
  if (!config) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    url: config.url,
    token: config.token,
  });
}
