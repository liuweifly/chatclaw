import { NextResponse } from "next/server";
import { startFeishuConnect } from "@/lib/channel-server";
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

  try {
    const result = await startFeishuConnect({
      request,
      userId: user.id,
      companyId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start Feishu connect";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
