import { randomBytes } from "crypto";

export interface TelegramBotProfile {
  id: number;
  username: string;
  first_name: string;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

function apiUrl(token: string, method: string) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function telegramRequest<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<TelegramApiResponse<T>> {
  const response = await fetch(apiUrl(token, method), {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  return (await response.json()) as TelegramApiResponse<T>;
}

export function isLikelyTelegramToken(value: string) {
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

export async function getTelegramBotProfile(token: string) {
  const payload = await telegramRequest<TelegramBotProfile>(token, "getMe");
  if (!payload.ok || !payload.result) {
    throw new Error(payload.description || "Could not verify Telegram bot token");
  }

  return payload.result;
}

export function createTelegramSecretToken() {
  return randomBytes(24).toString("hex");
}

export async function setTelegramWebhook(opts: {
  token: string;
  webhookUrl: string;
  secretToken: string;
}) {
  const payload = await telegramRequest<true>(opts.token, "setWebhook", {
    url: opts.webhookUrl,
    secret_token: opts.secretToken,
    allowed_updates: ["message"],
  });

  if (!payload.ok) {
    throw new Error(payload.description || "Telegram rejected the webhook setup");
  }
}

export async function deleteTelegramWebhook(token: string) {
  const payload = await telegramRequest<true>(token, "deleteWebhook", {
    drop_pending_updates: false,
  });

  if (!payload.ok) {
    throw new Error(payload.description || "Telegram rejected the webhook removal");
  }
}

export async function sendTelegramMessage(opts: {
  token: string;
  chatId: number | string;
  text: string;
  messageThreadId?: number;
}) {
  const payload = await telegramRequest<{ message_id: number }>(opts.token, "sendMessage", {
    chat_id: opts.chatId,
    text: opts.text.slice(0, 4000),
    message_thread_id: opts.messageThreadId,
  });

  if (!payload.ok) {
    throw new Error(payload.description || "Could not send Telegram message");
  }
}
