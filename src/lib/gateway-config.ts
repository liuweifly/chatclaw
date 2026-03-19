import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

export interface GatewayConfig {
  url: string;
  token: string;
  source: "env" | "local";
}

export interface GatewayAgentConfig {
  id: string;
  name: string;
  workspace?: string;
}

export type GatewayAvailabilityIssue =
  | "chat_completions_disabled"
  | "auth_failed"
  | "unreachable"
  | "unexpected_response";

export interface GatewayAvailability {
  chatReady: boolean;
  issue?: GatewayAvailabilityIssue;
  detail?: string;
}

type GatewayBindMode = "auto" | "lan" | "loopback" | "custom" | "tailnet";

type LocalGatewayConfigFile = {
  gateway?: {
    port?: number;
    bind?: GatewayBindMode;
    customBindHost?: string;
    auth?: {
      token?: string;
    };
    controlUi?: {
      basePath?: string;
    };
    http?: {
      endpoints?: {
        chatCompletions?: {
          enabled?: boolean;
        };
      };
    };
  };
  agents?: {
    list?: unknown[];
  };
};

const LOCAL_GATEWAY_CONFIG_PATH = join(homedir(), ".openclaw", "openclaw.json");

function readEnv(name: string): string {
  return process.env[name]?.trim() || "";
}

async function readLocalGatewayConfig(): Promise<LocalGatewayConfigFile | null> {
  try {
    const raw = await readFile(LOCAL_GATEWAY_CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as LocalGatewayConfigFile;
  } catch {
    return null;
  }
}

export function getEnvGatewayConfig(): GatewayConfig | null {
  const url = readEnv("GATEWAY_URL");
  const token = readEnv("GATEWAY_TOKEN");

  if (!url || !token) {
    return null;
  }

  return { url, token, source: "env" };
}

export async function getGatewayConfig(): Promise<GatewayConfig | null> {
  const envConfig = getEnvGatewayConfig();
  if (envConfig) {
    return envConfig;
  }

  const config = await readLocalGatewayConfig();
  const gateway = config?.gateway;
  if (!gateway?.auth?.token) {
    return null;
  }

  const port = gateway.port ?? 18789;

  return {
    url: `ws://localhost:${port}`,
    token: gateway.auth.token,
    source: "local",
  };
}

export async function getLocalGatewayAgents(): Promise<GatewayAgentConfig[]> {
  const config = await readLocalGatewayConfig();
  if (!config) {
    return [];
  }

  return normalizeAgentList(config.agents?.list ?? []);
}

export function toGatewayHttpBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/^ws:\/\//, "http://")
    .replace(/^wss:\/\//, "https://")
    .replace(/\/+$/, "");
}

function normalizeControlUiBasePath(basePath?: string): string {
  if (!basePath) {
    return "";
  }

  let normalized = basePath.trim();
  if (!normalized) {
    return "";
  }

  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }

  if (normalized === "/") {
    return "";
  }

  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function withDashboardToken(url: string, token: string): string {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return url;
  }

  try {
    const parsed = new URL(url);
    parsed.hash = `token=${encodeURIComponent(trimmedToken)}`;
    return parsed.toString();
  } catch {
    return `${url}#token=${encodeURIComponent(trimmedToken)}`;
  }
}

function buildDashboardUrl(params: {
  host: string;
  port: number;
  basePath?: string;
  token: string;
}): string {
  const basePath = normalizeControlUiBasePath(params.basePath);
  const uiPath = basePath ? `${basePath}/` : "/";
  return withDashboardToken(`http://${params.host}:${params.port}${uiPath}`, params.token);
}

function resolveLocalDashboardHost(gateway?: LocalGatewayConfigFile["gateway"]): string | null {
  const bind = gateway?.bind ?? "loopback";
  const customBindHost = gateway?.customBindHost?.trim();

  if (bind === "tailnet") {
    return null;
  }

  if (bind === "custom" && customBindHost) {
    return customBindHost;
  }

  return "127.0.0.1";
}

function inferEnvDashboardUrl(gatewayUrl: string, token: string): string | null {
  try {
    const parsed = new URL(toGatewayHttpBaseUrl(gatewayUrl));
    if (parsed.pathname && parsed.pathname !== "/") {
      return null;
    }

    parsed.pathname = "/";
    parsed.search = "";
    return withDashboardToken(parsed.toString(), token);
  } catch {
    return null;
  }
}

export async function getGatewayDashboardUrl(): Promise<string | null> {
  const envDashboardUrl = readEnv("GATEWAY_DASHBOARD_URL");
  const envToken = readEnv("GATEWAY_TOKEN");
  if (envDashboardUrl) {
    return withDashboardToken(envDashboardUrl, envToken);
  }

  const envConfig = getEnvGatewayConfig();
  if (envConfig) {
    return inferEnvDashboardUrl(envConfig.url, envConfig.token);
  }

  const config = await readLocalGatewayConfig();
  const gateway = config?.gateway;
  if (!gateway) {
    return null;
  }

  const token = gateway?.auth?.token?.trim();
  if (!token) {
    return null;
  }

  const host = resolveLocalDashboardHost(gateway);
  if (!host) {
    return null;
  }

  return buildDashboardUrl({
    host,
    port: gateway.port ?? 18789,
    basePath: gateway.controlUi?.basePath,
    token,
  });
}

function formatProbeDetail(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 240);
}

async function probeGatewayChatEndpoint(
  gatewayUrl: string,
  gatewayToken: string
): Promise<GatewayAvailability> {
  const baseUrl = toGatewayHttpBaseUrl(gatewayUrl);

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        "Content-Type": "application/json",
        "x-openclaw-agent-id": "main",
        "x-openclaw-session-key": "chatclaw:probe",
      },
      // Intentionally incomplete so a healthy endpoint can reject cheaply without
      // running a real model call.
      body: JSON.stringify({ stream: false }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (response.ok || response.status === 400 || response.status === 422) {
      return { chatReady: true };
    }

    const detail = formatProbeDetail(await response.text());
    if (response.status === 401 || response.status === 403) {
      return {
        chatReady: false,
        issue: "auth_failed",
        detail,
      };
    }

    if (response.status === 404 || response.status === 405) {
      return {
        chatReady: false,
        issue: "chat_completions_disabled",
        detail,
      };
    }

    return {
      chatReady: false,
      issue: "unexpected_response",
      detail: detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      chatReady: false,
      issue: "unreachable",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getGatewayAvailability(
  config: GatewayConfig
): Promise<GatewayAvailability> {
  if (config.source === "local") {
    const localConfig = await readLocalGatewayConfig();
    if (localConfig?.gateway?.http?.endpoints?.chatCompletions?.enabled !== true) {
      return {
        chatReady: false,
        issue: "chat_completions_disabled",
        detail:
          "Enable gateway.http.endpoints.chatCompletions.enabled in ~/.openclaw/openclaw.json and restart OpenClaw.",
      };
    }
  }

  return probeGatewayChatEndpoint(config.url, config.token);
}

export async function fetchRemoteGatewayAgents(
  gatewayUrl: string,
  gatewayToken: string
): Promise<GatewayAgentConfig[]> {
  const baseUrl = toGatewayHttpBaseUrl(gatewayUrl);
  const headers = {
    Authorization: `Bearer ${gatewayToken}`,
  };

  const agents = await fetchJson(`${baseUrl}/v1/agents`, headers);
  const normalizedAgents = normalizeAgentList(extractList(agents));
  if (normalizedAgents.length > 0) {
    return normalizedAgents;
  }

  const models = await fetchJson(`${baseUrl}/v1/models`, headers);
  const modelAgents = normalizeModelList(extractList(models));
  if (modelAgents.length > 0) {
    return modelAgents;
  }

  const guessedAgentId = guessAgentIdFromUrl(gatewayUrl) || "main";
  return [{ id: guessedAgentId, name: guessedAgentId }];
}

async function fetchJson(
  url: string,
  headers: Record<string, string>
): Promise<unknown> {
  try {
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function extractList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.data)) {
      return record.data;
    }

    if (Array.isArray(record.agents)) {
      return record.agents;
    }

    if (Array.isArray(record.list)) {
      return record.list;
    }
  }

  return [];
}

function normalizeAgentList(value: unknown[]): GatewayAgentConfig[] {
  const agents = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    if (!id) {
      return [];
    }

    const name =
      typeof record.name === "string"
        ? record.name
        : typeof record.displayName === "string"
          ? record.displayName
          : id;

    const workspace =
      typeof record.workspace === "string" ? record.workspace : undefined;

    return [{ id, name, workspace }];
  });

  return dedupeAgents(agents);
}

function normalizeModelList(value: unknown[]): GatewayAgentConfig[] {
  const agents = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const modelId = typeof record.id === "string" ? record.id : "";
    if (!modelId) {
      return [];
    }

    const agentId =
      modelId === "openclaw"
        ? "main"
        : modelId.startsWith("openclaw:")
          ? modelId.slice("openclaw:".length)
          : "";

    if (!agentId) {
      return [];
    }

    const name =
      typeof record.name === "string"
        ? record.name
        : typeof record.display_name === "string"
          ? record.display_name
          : agentId;

    return [{ id: agentId, name }];
  });

  return dedupeAgents(agents);
}

function dedupeAgents(agents: GatewayAgentConfig[]): GatewayAgentConfig[] {
  const uniqueAgents = new Map<string, GatewayAgentConfig>();

  for (const agent of agents) {
    if (!uniqueAgents.has(agent.id)) {
      uniqueAgents.set(agent.id, agent);
    }
  }

  return [...uniqueAgents.values()];
}

function guessAgentIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length >= 2 && segments[segments.length - 2] === "proxy") {
      return decodeURIComponent(segments[segments.length - 1]);
    }
  } catch {
    return null;
  }

  return null;
}
