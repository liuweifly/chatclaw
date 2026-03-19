import { randomUUID } from "crypto";
import { getOwnedWorkspace } from "@/lib/agent-security";
import {
  buildChannelSummaryMap,
  buildTelegramWebhookUrl,
  getAppBaseUrl,
  getFeishuInstallUrlTemplate,
  isPublicHttpsUrl,
  readChannelConfig,
  type ChannelSummary,
  type FeishuChannelConfig,
  type TelegramChannelConfig,
} from "@/lib/channel-integrations";
import { decryptSecret, encryptSecret, signState, verifyState } from "@/lib/channel-crypto";
import {
  createTelegramSecretToken,
  deleteTelegramWebhook,
  getTelegramBotProfile,
  isLikelyTelegramToken,
  setTelegramWebhook,
} from "@/lib/channel-telegram";
import { runGatewayPrompt } from "@/lib/gateway-server";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { ChannelRecord, LobsterRecord } from "@/lib/supabase/shared";

const CHANNEL_COLUMNS =
  "id,lobster_id,type,config,status,created_at,updated_at,connected_at,last_error";

function mergeConfig(
  existing: ChannelRecord | null,
  updates: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...readChannelConfig<Record<string, unknown>>(existing?.config),
    ...updates,
  };
}

async function selectChannelByType(companyId: string, type: string) {
  const supabase = createServerClient();
  return supabase.db.select<ChannelRecord | null>("channels", {
    columns: CHANNEL_COLUMNS,
    filters: {
      lobster_id: companyId,
      type,
    },
    maybeSingle: true,
  });
}

export async function listWorkspaceChannels(
  companyId: string,
  options?: {
    hasDefaultAgent?: boolean;
    request?: Request;
  }
) {
  const supabase = createServerClient();
  const records = await supabase.db.select<ChannelRecord[]>("channels", {
    columns: CHANNEL_COLUMNS,
    filters: {
      lobster_id: companyId,
    },
    order: { column: "created_at", ascending: true },
  });

  const baseUrl = getAppBaseUrl(options?.request);
  const publicWebhookReady = isPublicHttpsUrl(baseUrl);
  const template = getFeishuInstallUrlTemplate();
  const feishuConnectUrl =
    publicWebhookReady && template
      ? `/api/workspaces/${companyId}/channels/feishu/connect`
      : null;

  return buildChannelSummaryMap(records, {
    feishuConnectUrl,
    hasDefaultAgent: options?.hasDefaultAgent !== false,
    publicWebhookReady,
  });
}

function buildFeishuInstallUrl(
  template: string,
  replacements: { state: string; callbackUrl: string }
) {
  return template
    .replaceAll("{STATE}", encodeURIComponent(replacements.state))
    .replaceAll("{CALLBACK_URL}", encodeURIComponent(replacements.callbackUrl));
}

export async function connectTelegramChannel(opts: {
  request: Request;
  userId: string;
  companyId: string;
  token: string;
}) {
  const company = await getOwnedWorkspace(opts.userId, opts.companyId);
  if (!company) {
    throw new Error("Forbidden");
  }

  if (!company.agent_id) {
    throw new Error("Set a default agent before connecting Telegram.");
  }

  const token = opts.token.trim();
  if (!isLikelyTelegramToken(token)) {
    throw new Error("Telegram bot token format looks invalid.");
  }

  const baseUrl = getAppBaseUrl(opts.request);
  if (!isPublicHttpsUrl(baseUrl)) {
    throw new Error("A public HTTPS app URL is required before Telegram can connect.");
  }

  const existing = await selectChannelByType(opts.companyId, "telegram");
  const existingConfig = readChannelConfig<TelegramChannelConfig>(existing?.config);
  const previousToken =
    typeof existingConfig.botToken === "string"
      ? safeDecrypt(existingConfig.botToken)
      : null;

  const bot = await getTelegramBotProfile(token);
  const channelId = existing?.id ?? randomUUID();
  const webhookUrl = buildTelegramWebhookUrl(baseUrl, channelId);
  const secretToken = createTelegramSecretToken();

  await setTelegramWebhook({
    token,
    webhookUrl,
    secretToken,
  });

  if (previousToken && previousToken !== token) {
    try {
      await deleteTelegramWebhook(previousToken);
    } catch {
      // Old webhook cleanup should not block the new connection.
    }
  }

  const now = new Date().toISOString();
  const nextConfig = mergeConfig(existing, {
    botToken: encryptSecret(token),
    botId: bot.id,
    username: bot.username,
    displayName: bot.first_name,
    webhookUrl,
    secretToken,
  });

  const supabase = createServerClient();
  if (existing) {
    const updated = await supabase.db.update<ChannelRecord>(
      "channels",
      {
        config: nextConfig,
        status: "connected",
        connected_at: now,
        updated_at: now,
        last_error: null,
      },
      {
        id: existing.id,
        lobster_id: opts.companyId,
      }
    );
    return updated[0];
  }

  const inserted = await supabase.db.insert<ChannelRecord>("channels", {
    id: channelId,
    lobster_id: opts.companyId,
    type: "telegram",
    config: nextConfig,
    status: "connected",
    created_at: now,
    updated_at: now,
    connected_at: now,
    last_error: null,
  });

  return inserted[0];
}

async function updateChannelError(channelId: string, error: string) {
  const supabase = createServiceRoleClient();
  await supabase.db.update<ChannelRecord>(
    "channels",
    {
      status: "error",
      updated_at: new Date().toISOString(),
      last_error: error,
    },
    {
      id: channelId,
    }
  );
}

export async function startFeishuConnect(opts: {
  request: Request;
  userId: string;
  companyId: string;
}) {
  const company = await getOwnedWorkspace(opts.userId, opts.companyId);
  if (!company) {
    throw new Error("Forbidden");
  }

  const baseUrl = getAppBaseUrl(opts.request);
  if (!isPublicHttpsUrl(baseUrl)) {
    throw new Error("A public HTTPS app URL is required before Feishu can connect.");
  }

  const template = getFeishuInstallUrlTemplate();
  if (!template) {
    throw new Error("Feishu install is not configured on the server.");
  }

  const existing = await selectChannelByType(opts.companyId, "feishu");
  const channelId = existing?.id ?? randomUUID();
  const callbackUrl = `${baseUrl}/api/channels/feishu/callback`;
  const state = signState({
    channelId,
    companyId: opts.companyId,
    provider: "feishu",
  });
  const connectUrl = buildFeishuInstallUrl(template, {
    state,
    callbackUrl,
  });

  const now = new Date().toISOString();
  const nextConfig = mergeConfig(existing, {
    installUrl: connectUrl,
    callbackUrl,
    installState: "awaiting_install",
  });

  const supabase = createServerClient();
  const payload = {
    config: nextConfig,
    status: "action_required",
    updated_at: now,
    last_error: null,
  };

  if (existing) {
    const updated = await supabase.db.update<ChannelRecord>(
      "channels",
      payload,
      {
        id: existing.id,
        lobster_id: opts.companyId,
      }
    );
    return { channel: updated[0], connectUrl };
  }

  const inserted = await supabase.db.insert<ChannelRecord>("channels", {
    id: channelId,
    lobster_id: opts.companyId,
    type: "feishu",
    created_at: now,
    ...payload,
  });

  return { channel: inserted[0], connectUrl };
}

export async function disconnectChannel(opts: {
  userId: string;
  companyId: string;
  channelId: string;
}) {
  const company = await getOwnedWorkspace(opts.userId, opts.companyId);
  if (!company) {
    throw new Error("Forbidden");
  }

  const supabase = createServerClient();
  const channel = await supabase.db.select<ChannelRecord | null>("channels", {
    columns: CHANNEL_COLUMNS,
    filters: {
      id: opts.channelId,
      lobster_id: opts.companyId,
    },
    maybeSingle: true,
  });

  if (!channel) {
    throw new Error("Channel not found");
  }

  if (channel.type === "telegram") {
    const config = readChannelConfig<TelegramChannelConfig>(channel.config);
    const token =
      typeof config.botToken === "string" ? safeDecrypt(config.botToken) : null;
    if (token) {
      try {
        await deleteTelegramWebhook(token);
      } catch {
        // Prefer removing the local connection even if Telegram webhook cleanup fails.
      }
    }
  }

  await supabase.db.delete("channels", {
    id: channel.id,
    lobster_id: opts.companyId,
  });
}

function safeDecrypt(payload: string) {
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}

export async function getChannelById(channelId: string) {
  const supabase = createServiceRoleClient();
  return supabase.db.select<ChannelRecord | null>("channels", {
    columns: CHANNEL_COLUMNS,
    filters: {
      id: channelId,
    },
    maybeSingle: true,
  });
}

export async function getCompanyById(companyId: string) {
  const supabase = createServiceRoleClient();
  return supabase.db.select<LobsterRecord | null>("lobsters", {
    filters: {
      id: companyId,
    },
    maybeSingle: true,
  });
}

export function getDecryptedTelegramConfig(channel: ChannelRecord) {
  const config = readChannelConfig<TelegramChannelConfig>(channel.config);
  return {
    ...config,
    botToken:
      typeof config.botToken === "string" ? safeDecrypt(config.botToken) : null,
  };
}

export async function markFeishuCallbackResult(opts: {
  searchParams: URLSearchParams;
}) {
  const state = opts.searchParams.get("state");
  if (!state) {
    throw new Error("Missing state");
  }

  const verified = verifyState<{ channelId?: string; companyId?: string; provider?: string }>(state);
  if (!verified || verified.provider !== "feishu" || !verified.channelId) {
    throw new Error("Invalid callback state");
  }

  const channel = await getChannelById(verified.channelId);
  if (!channel) {
    throw new Error("Channel not found");
  }

  const error = opts.searchParams.get("error") || opts.searchParams.get("message");
  const tenantKey =
    opts.searchParams.get("tenant_key") ||
    opts.searchParams.get("tenantKey") ||
    opts.searchParams.get("tenant") ||
    null;

  const currentConfig = readChannelConfig<FeishuChannelConfig>(channel.config);
  const callbackParams = Object.fromEntries(opts.searchParams.entries());
  const isConnected = Boolean(!error && tenantKey);
  const nextConfig = {
    ...currentConfig,
    tenantKey,
    installState: isConnected ? "connected" : "awaiting_install",
    lastCallbackParams: callbackParams,
  };
  const lastError = error || (!tenantKey ? "Feishu callback did not include a tenant identifier." : null);

  const supabase = createServiceRoleClient();
  const updated = await supabase.db.update<ChannelRecord>(
    "channels",
    {
      config: nextConfig,
      status: isConnected ? "connected" : "action_required",
      updated_at: new Date().toISOString(),
      connected_at: isConnected ? new Date().toISOString() : null,
      last_error: lastError,
    },
    {
      id: channel.id,
    }
  );

  return updated[0];
}

export async function handleTelegramInboundMessage(opts: {
  channelId: string;
  body: Record<string, unknown>;
  secretHeader: string | null;
}) {
  const channel = await getChannelById(opts.channelId);
  if (!channel || channel.type !== "telegram") {
    throw new Error("Channel not found");
  }

  const config = getDecryptedTelegramConfig(channel);
  if (!config.botToken || !config.secretToken) {
    throw new Error("Telegram credentials are not configured");
  }

  if (opts.secretHeader !== config.secretToken) {
    throw new Error("Invalid Telegram webhook secret");
  }

  const message = readMessageUpdate(opts.body);
  if (!message?.text?.trim()) {
    return;
  }

  try {
    const company = await getCompanyById(channel.lobster_id);
    if (!company?.agent_id) {
      throw new Error("This workspace does not have a default agent yet.");
    }

    const threadSuffix =
      typeof message.threadId === "number" ? `:${message.threadId}` : "";
    const sessionKey = `agent:${company.agent_id}:channel:telegram:${channel.id}:${message.chatId}${threadSuffix}`;
    const reply = await runGatewayPrompt({
      agentId: company.agent_id,
      sessionKey,
      message: message.text.trim(),
    });

    const finalReply = reply.trim() || "I received your message, but I do not have a reply yet.";

    const { sendTelegramMessage } = await import("@/lib/channel-telegram");
    await sendTelegramMessage({
      token: config.botToken,
      chatId: message.chatId,
      text: finalReply,
      messageThreadId: message.threadId,
    });

    const supabase = createServiceRoleClient();
    await supabase.db.update<ChannelRecord>(
      "channels",
      {
        status: "connected",
        updated_at: new Date().toISOString(),
        last_error: null,
      },
      {
        id: channel.id,
      }
    );
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Telegram delivery failed.";

    await updateChannelError(channel.id, messageText);

    try {
      const { sendTelegramMessage } = await import("@/lib/channel-telegram");
      await sendTelegramMessage({
        token: config.botToken,
        chatId: message.chatId,
        text: messageText,
        messageThreadId: message.threadId,
      });
    } catch {
      // If Telegram itself fails here, the channel record already carries the runtime error.
    }
  }
}

function readMessageUpdate(payload: Record<string, unknown>) {
  const message = payload.message;
  if (!message || typeof message !== "object") {
    return null;
  }

  const record = message as Record<string, unknown>;
  const chat = record.chat;
  if (!chat || typeof chat !== "object") {
    return null;
  }

  const chatRecord = chat as Record<string, unknown>;
  const chatId = chatRecord.id;
  const text = record.text;
  const threadId = record.message_thread_id;

  if ((typeof chatId !== "number" && typeof chatId !== "string") || typeof text !== "string") {
    return null;
  }

  return {
    chatId,
    text,
    threadId: typeof threadId === "number" ? threadId : undefined,
  };
}

export interface WorkspaceChannelsResponse {
  channels: ChannelSummary[];
}
