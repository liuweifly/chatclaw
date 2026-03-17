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

function readEnv(name: string): string {
  return process.env[name]?.trim() || "";
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

  try {
    const configPath = join(homedir(), ".openclaw", "openclaw.json");
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);

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
  } catch {
    return null;
  }
}

export async function getLocalGatewayAgents(): Promise<GatewayAgentConfig[]> {
  try {
    const configPath = join(homedir(), ".openclaw", "openclaw.json");
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);

    return normalizeAgentList(config?.agents?.list ?? []);
  } catch {
    return [];
  }
}

export function toGatewayHttpBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/^ws:\/\//, "http://")
    .replace(/^wss:\/\//, "https://")
    .replace(/\/+$/, "");
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
