import { v4 as uuidv4 } from "uuid";
import type { GatewayAvailabilityIssue } from "@/lib/gateway-config";
import type {
  ChatEventPayload,
  ConnectionStatus,
} from "@/types";

// ── Types ───────────────────────────────────────────────────────────

export type GatewayEventHandler = {
  onConnectionStatus?: (status: ConnectionStatus) => void;
  onChatEvent?: (payload: ChatEventPayload) => void;
  onError?: (error: string) => void;
};

type DetectGatewayPayload = {
  found?: boolean;
  hasToken?: boolean;
  chatReady?: boolean;
  issue?: GatewayAvailabilityIssue;
  detail?: string;
};

export function getDetectedGatewayStatusMessage(
  payload: DetectGatewayPayload
): string {
  if (!payload.found) {
    return "Gateway not detected";
  }

  if (!payload.hasToken) {
    return "Gateway token missing on server";
  }

  switch (payload.issue) {
    case "chat_completions_disabled":
      return payload.detail ||
        "Gateway chat endpoint is disabled. Enable gateway.http.endpoints.chatCompletions.enabled and restart OpenClaw.";
    case "auth_failed":
      return payload.detail
        ? `Gateway auth failed: ${payload.detail}`
        : "Gateway auth failed";
    case "unreachable":
      return payload.detail
        ? `Gateway HTTP endpoint unreachable: ${payload.detail}`
        : "Gateway HTTP endpoint unreachable";
    case "unexpected_response":
      return payload.detail
        ? `Gateway probe failed: ${payload.detail}`
        : "Gateway probe failed";
    default:
      return "Gateway is not ready for chat";
  }
}

// ── Gateway Client (HTTP SSE) ──────────────────────────────────────

export class GatewayClient {
  private handlers: GatewayEventHandler = {};
  private destroyed = false;
  private connected = false;
  private activeAbortControllers = new Map<string, AbortController>();

  configure(handlers: GatewayEventHandler): void {
    this.handlers = handlers;
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;
    this.handlers.onConnectionStatus?.("connecting");

    try {
      const response = await fetch("/api/detect-gateway", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as DetectGatewayPayload;

      this.connected = Boolean(
        payload.found &&
        payload.hasToken &&
        payload.chatReady !== false
      );
      this.handlers.onConnectionStatus?.(this.connected ? "connected" : "disconnected");
      if (!this.connected) {
        this.handlers.onError?.(getDetectedGatewayStatusMessage(payload));
      }
    } catch (error) {
      this.connected = false;
      this.handlers.onConnectionStatus?.("error");
      this.handlers.onError?.(String(error));
    }
  }

  disconnect(): void {
    for (const controller of this.activeAbortControllers.values()) {
      controller.abort();
    }
    this.activeAbortControllers.clear();
    this.connected = false;
    this.handlers.onConnectionStatus?.("disconnected");
  }

  destroy(): void {
    this.destroyed = true;
    this.disconnect();
  }

  isConnected(): boolean {
    return this.connected && !this.destroyed;
  }

  async sendMessage(sessionKey: string, message: string): Promise<void> {
    const agentId = this.extractAgentId(sessionKey);
    const abortController = new AbortController();
    this.activeAbortControllers.set(sessionKey, abortController);

    const runId = uuidv4();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-openclaw-agent-id": agentId,
          "x-openclaw-session-key": sessionKey,
        },
        body: JSON.stringify({
          model: `openclaw:${agentId}`,
          messages: [{ role: "user", content: message }],
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        this.handlers.onChatEvent?.({
          runId,
          sessionKey,
          state: "error",
          message: { role: "assistant", content: [{ type: "text", text: "" }], timestamp: Date.now() },
          error: `HTTP ${res.status}: ${errorText}`,
        });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;
          if (!trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            this.handlers.onChatEvent?.({
              runId,
              sessionKey,
              state: "final",
              message: {
                role: "assistant",
                content: [{ type: "text", text: accumulated }],
                timestamp: Date.now(),
              },
            });
            this.activeAbortControllers.delete(sessionKey);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              this.handlers.onChatEvent?.({
                runId,
                sessionKey,
                state: "delta",
                message: {
                  role: "assistant",
                  content: [{ type: "text", text: accumulated }],
                  timestamp: Date.now(),
                },
              });
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // If we exit without [DONE], emit final with whatever we have
      if (accumulated) {
        this.handlers.onChatEvent?.({
          runId,
          sessionKey,
          state: "final",
          message: {
            role: "assistant",
            content: [{ type: "text", text: accumulated }],
            timestamp: Date.now(),
          },
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        this.handlers.onChatEvent?.({
          runId,
          sessionKey,
          state: "aborted",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "" }],
            timestamp: Date.now(),
          },
        });
      } else {
        this.handlers.onChatEvent?.({
          runId,
          sessionKey,
          state: "error",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "" }],
            timestamp: Date.now(),
          },
          error: String(err),
        });
      }
    } finally {
      this.activeAbortControllers.delete(sessionKey);
    }
  }

  async abortChat(sessionKey: string, runId?: string): Promise<void> {
    void runId;
    const controller = this.activeAbortControllers.get(sessionKey);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(sessionKey);
    }
  }

  private extractAgentId(sessionKey: string): string {
    const parts = sessionKey.split(":");
    return parts[1] || "main";
  }
}

// ── Singleton ─────────────────────────────────────────────────────

let instance: GatewayClient | null = null;

export function getGateway(): GatewayClient {
  if (!instance) {
    instance = new GatewayClient();
  }
  return instance;
}

export function resetGateway(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

// ── Test Connection (HTTP) ────────────────────────────────────────

export async function testConnection(
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/detect-gateway", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const payload = (await res.json()) as DetectGatewayPayload;

    if (!payload.found) {
      return { ok: false, error: "Gateway not detected" };
    }

    if (!payload.hasToken) {
      return { ok: false, error: "Gateway token missing on server" };
    }

    if (payload.chatReady === false) {
      return { ok: false, error: getDetectedGatewayStatusMessage(payload) };
    }

    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      return { ok: false, error: "Connection timed out" };
    }
    return { ok: false, error: `Connection failed: ${e}` };
  }
}
