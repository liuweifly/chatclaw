import { NextRequest } from "next/server";
import { getGatewayConfig, toGatewayHttpBaseUrl } from "@/lib/gateway-config";
import { getServerUser } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const gateway = await getGatewayConfig();
  if (!gateway) {
    return new Response("Gateway is not configured on the server.", { status: 503 });
  }

  const agentId = req.headers.get("x-openclaw-agent-id") || "main";
  const sessionKey = req.headers.get("x-openclaw-session-key") || "";
  const body = await req.text();
  const baseUrl = toGatewayHttpBaseUrl(gateway.url);

  const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gateway.token}`,
      "Content-Type": "application/json",
      "x-openclaw-agent-id": agentId,
      "x-openclaw-session-key": sessionKey,
    },
    body,
    cache: "no-store",
  });

  if (!upstream.ok) {
    const errorText = await upstream.text();
    return new Response(errorText, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
