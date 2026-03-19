import { NextResponse } from "next/server";
import { normalizePlan, resolveCreemBaseUrl, resolveCreemProductId } from "@/lib/billing";
import { createServerClient } from "@/lib/supabase/server";

function getCreemApiKey() {
  const value = process.env.CREEM_API_KEY;
  if (!value) {
    throw new Error("Missing CREEM_API_KEY");
  }
  return value;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const user = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.text();
  let body: { plan?: string } = {};

  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody) as { plan?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const plan = normalizePlan(body.plan);

  if (plan === "free") {
    return NextResponse.json({ error: "Free does not require checkout" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const response = await fetch(`${resolveCreemBaseUrl()}/v1/checkouts`, {
    method: "POST",
    headers: {
      "x-api-key": getCreemApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: resolveCreemProductId(),
      request_id: `${user.id}:${plan}:${Date.now()}`,
      success_url: `${origin}/dashboard?billing=success&plan=${plan}`,
      cancel_url: `${origin}/dashboard?billing=canceled`,
      customer: {
        email: user.email,
      },
      metadata: {
        userId: user.id,
        plan,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: `Creem checkout failed: ${message}` },
      { status: 500 }
    );
  }

  const payload = (await response.json()) as { checkout_url?: string };

  return NextResponse.json({ url: payload.checkout_url ?? null });
}
