import { NextResponse } from "next/server";
import { markFeishuCallbackResult } from "@/lib/channel-server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    await markFeishuCallbackResult({
      searchParams: url.searchParams,
    });

    return NextResponse.redirect(new URL("/dashboard?channel=feishu&status=connected", url));
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
