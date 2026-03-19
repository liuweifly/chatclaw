import { NextResponse } from "next/server";
import { connectTelegramChannel } from "@/lib/channel-server";
import { getServerUser } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await context.params;
  const body = (await request.json()) as { token?: string };

  if (!body.token?.trim()) {
    return NextResponse.json({ error: "Telegram bot token is required" }, { status: 400 });
  }

  try {
    const channel = await connectTelegramChannel({
      request,
      userId: user.id,
      companyId,
      token: body.token,
    });
    return NextResponse.json({ channel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect Telegram";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
