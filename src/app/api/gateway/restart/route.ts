import { NextResponse } from "next/server";
import { getGatewayConfig } from "@/lib/gateway-config";
import { getServerUser } from "@/lib/supabase/server";

export async function POST() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
