import { NextResponse } from "next/server";
import { handleTelegramInboundMessage } from "@/lib/channel-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    await handleTelegramInboundMessage({
      channelId,
      body,
      secretHeader: request.headers.get("x-telegram-bot-api-secret-token"),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    const status = message === "Invalid Telegram webhook secret" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
