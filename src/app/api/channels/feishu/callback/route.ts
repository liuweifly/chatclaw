import { NextResponse } from "next/server";
import { markFeishuCallbackResult } from "@/lib/channel-server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const channel = await markFeishuCallbackResult({
      searchParams: url.searchParams,
    });

    const status = channel.status === "connected" ? "connected" : "action_required";
    const message = channel.last_error ? `&message=${encodeURIComponent(channel.last_error)}` : "";
    return NextResponse.redirect(
      new URL(`/dashboard?channel=feishu&status=${status}${message}`, url)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feishu callback failed";
    return NextResponse.redirect(
      new URL(
        `/dashboard?channel=feishu&status=error&message=${encodeURIComponent(message)}`,
        url
      )
    );
  }
}
