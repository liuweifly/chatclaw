import { getGatewayConfig, toGatewayHttpBaseUrl } from "@/lib/gateway-config";

export async function runGatewayPrompt(opts: {
  agentId: string;
  sessionKey: string;
  message: string;
}) {
  const gateway = await getGatewayConfig();
  if (!gateway) {
    throw new Error("Gateway is not configured on the server.");
  }

  const upstream = await fetch(`${toGatewayHttpBaseUrl(gateway.url)}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gateway.token}`,
      "Content-Type": "application/json",
      "x-openclaw-agent-id": opts.agentId,
      "x-openclaw-session-key": opts.sessionKey,
    },
    body: JSON.stringify({
      model: `openclaw:${opts.agentId}`,
      messages: [{ role: "user", content: opts.message }],
      stream: true,
    }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    const errorText = await upstream.text();
    throw new Error(errorText || `Gateway request failed (${upstream.status})`);
  }

  const reader = upstream.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data: ")) {
        continue;
      }

      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        return accumulated;
      }

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    }
  }

  return accumulated;
}
