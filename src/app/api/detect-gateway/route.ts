import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/gateway-config";
import { getServerUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getGatewayConfig();
  if (!config) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    url: config.url,
    hasToken: Boolean(config.token),
    source: config.source,
  });
}
