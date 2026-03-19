import { NextResponse } from "next/server";
import {
  getGatewayAvailability,
  getGatewayConfig,
  getGatewayDashboardUrl,
} from "@/lib/gateway-config";
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

  const [availability, dashboardUrl] = await Promise.all([
    getGatewayAvailability(config),
    getGatewayDashboardUrl(),
  ]);

  return NextResponse.json({
    found: true,
    url: config.url,
    dashboardUrl,
    hasToken: Boolean(config.token),
    source: config.source,
    chatReady: availability.chatReady,
    issue: availability.issue,
    detail: availability.detail,
  });
}
