import { NextResponse } from "next/server";
import { disconnectChannel } from "@/lib/channel-server";
import { getServerUser } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ companyId: string; channelId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, channelId } = await context.params;

  try {
    await disconnectChannel({
      userId: user.id,
      companyId,
      channelId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not disconnect channel";
    const status =
      message === "Forbidden" ? 403 : message === "Channel not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
