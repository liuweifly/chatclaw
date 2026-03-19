import type { ChannelRecord } from "@/lib/supabase/shared";

export const CHANNEL_ORDER = ["web", "telegram", "feishu", "discord", "slack"] as const;
export const MANAGED_CHANNELS = ["telegram", "feishu"] as const;

export type ChannelKey = (typeof CHANNEL_ORDER)[number];
export type ManagedChannelKey = (typeof MANAGED_CHANNELS)[number];
export type ChannelConnectionStatus =
  | "connected"
  | "not_connected"
  | "action_required"
  | "error"
  | "coming_soon";

export interface TelegramChannelConfig {
  botToken?: string;
  botId?: number;
  username?: string;
  displayName?: string;
  webhookUrl?: string;
  secretToken?: string;
}

export interface FeishuChannelConfig {
  installUrl?: string;
  callbackUrl?: string;
  tenantKey?: string;
  appId?: string;
  appName?: string;
  installState?: "ready" | "awaiting_install" | "connected";
  lastCallbackParams?: Record<string, string>;
}

export interface ChannelSummary {
  key: ChannelKey;
  id: string | null;
  status: ChannelConnectionStatus;
  connectedAt: string | null;
  lastError: string | null;
  accountLabel: string | null;
  details: string | null;
  canConnect: boolean;
  canDisconnect: boolean;
  connectMode: "none" | "telegram_token" | "feishu_install";
  connectUrl: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readChannelConfig<T>(value: unknown): Partial<T> {
  return isObject(value) ? (value as Partial<T>) : {};
}

export function maskToken(value: string) {
  if (value.length <= 8) {
    return "********";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function fromEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export function getAppBaseUrl(request?: Request) {
  const vercelProductionUrl = fromEnv("VERCEL_PROJECT_PRODUCTION_URL");
  const vercelUrl = fromEnv("VERCEL_URL");
  const candidates = [
    fromEnv("APP_URL"),
    fromEnv("NEXT_PUBLIC_APP_URL"),
    vercelProductionUrl ? `https://${vercelProductionUrl}` : "",
    vercelUrl ? `https://${vercelUrl}` : "",
    request ? new URL(request.url).origin : "",
  ].filter(Boolean);

  return candidates[0]?.replace(/\/+$/, "") || "";
}

export function isPublicHttpsUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    ) {
      return false;
    }

    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function buildTelegramWebhookUrl(baseUrl: string, channelId: string) {
  return `${baseUrl}/api/integrations/telegram/webhook/${channelId}`;
}

export function getFeishuInstallUrlTemplate() {
  return (
    fromEnv("FEISHU_INSTALL_URL_TEMPLATE") ||
    fromEnv("NEXT_PUBLIC_FEISHU_INSTALL_URL_TEMPLATE") ||
    fromEnv("FEISHU_INSTALL_URL") ||
    fromEnv("NEXT_PUBLIC_FEISHU_INSTALL_URL")
  );
}

export function buildChannelSummaryMap(
  records: ChannelRecord[],
  options: {
    feishuConnectUrl?: string | null;
    publicWebhookReady: boolean;
  }
) {
  const byType = new Map(records.map((record) => [record.type, record]));

  const telegramRecord = byType.get("telegram");
  const telegramConfig = readChannelConfig<TelegramChannelConfig>(telegramRecord?.config);

  const feishuRecord = byType.get("feishu");
  const feishuConfig = readChannelConfig<FeishuChannelConfig>(feishuRecord?.config);

  const summaries: Record<ChannelKey, ChannelSummary> = {
    web: {
      key: "web",
      id: null,
      status: "connected",
      connectedAt: null,
      lastError: null,
      accountLabel: null,
      details: null,
      canConnect: false,
      canDisconnect: false,
      connectMode: "none",
      connectUrl: null,
    },
    telegram: {
      key: "telegram",
      id: telegramRecord?.id ?? null,
      status:
        (telegramRecord?.status as ChannelConnectionStatus | undefined) ||
        (options.publicWebhookReady ? "not_connected" : "action_required"),
      connectedAt: telegramRecord?.connected_at ?? null,
      lastError: telegramRecord?.last_error ?? null,
      accountLabel: telegramConfig.username ? `@${telegramConfig.username}` : null,
      details: options.publicWebhookReady
        ? null
        : "A public HTTPS app URL is required before Telegram can finish webhook setup.",
      canConnect: true,
      canDisconnect: Boolean(telegramRecord),
      connectMode: "telegram_token",
      connectUrl: null,
    },
    feishu: {
      key: "feishu",
      id: feishuRecord?.id ?? null,
      status:
        (feishuRecord?.status as ChannelConnectionStatus | undefined) ||
        (options.feishuConnectUrl ? "not_connected" : "action_required"),
      connectedAt: feishuRecord?.connected_at ?? null,
      lastError: feishuRecord?.last_error ?? null,
      accountLabel: feishuConfig.tenantKey ?? feishuConfig.appName ?? null,
      details: options.feishuConnectUrl
        ? null
        : "Feishu install is not configured on the server yet.",
      canConnect: Boolean(options.feishuConnectUrl),
      canDisconnect: Boolean(feishuRecord),
      connectMode: "feishu_install",
      connectUrl: options.feishuConnectUrl ?? null,
    },
    discord: {
      key: "discord",
      id: null,
      status: "action_required",
      connectedAt: null,
      lastError: null,
      accountLabel: null,
      details: "Discord is still a manual gateway-only setup in this build.",
      canConnect: false,
      canDisconnect: false,
      connectMode: "none",
      connectUrl: null,
    },
    slack: {
      key: "slack",
      id: null,
      status: "coming_soon",
      connectedAt: null,
      lastError: null,
      accountLabel: null,
      details: null,
      canConnect: false,
      canDisconnect: false,
      connectMode: "none",
      connectUrl: null,
    },
  };

  return CHANNEL_ORDER.map((key) => summaries[key]);
}
