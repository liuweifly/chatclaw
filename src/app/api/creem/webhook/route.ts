import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { normalizePlan } from "@/lib/billing";
import { createServerClient } from "@/lib/supabase/server";
import type { ProfileRecord, SubscriptionRecord } from "@/lib/supabase/shared";

function getWebhookSecret() {
  const value = process.env.CREEM_WEBHOOK_SECRET;
  if (!value) {
    throw new Error("Missing CREEM_WEBHOOK_SECRET");
  }
  return value;
}

function verifySignature(payload: string, signature: string | null) {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", getWebhookSecret())
    .update(payload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function eventMetadata(input: unknown) {
  if (!input || typeof input !== "object") return {};
  return input as Record<string, unknown>;
}

async function resolveUserIdFromEmail(email?: string | null) {
  if (!email) return null;
  const supabase = createServerClient();
  const profile = await supabase.db.select<ProfileRecord | null>("profiles", {
    filters: { email },
    maybeSingle: true,
  });
  return profile?.id ?? null;
}

async function upsertSubscriptionForUser(
  userId: string,
  payload: Partial<SubscriptionRecord> & { plan?: string; status?: string }
) {
  const supabase = createServerClient();
  const existing = await supabase.db.select<SubscriptionRecord[]>("subscriptions", {
    filters: { user_id: userId },
    order: { column: "updated_at", ascending: false },
    limit: 1,
  });

  const record = {
    plan: normalizePlan(payload.plan),
    status: payload.status ?? "active",
    creem_customer_id: payload.creem_customer_id ?? null,
    creem_subscription_id: payload.creem_subscription_id ?? null,
    current_period_start: payload.current_period_start ?? null,
    current_period_end: payload.current_period_end ?? null,
  };

  if (existing[0]) {
    await supabase.db.update("subscriptions", record, { id: existing[0].id });
    return;
  }

  await supabase.db.insert("subscriptions", {
    user_id: userId,
    ...record,
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("creem-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    eventType?: string;
    object?: Record<string, unknown>;
  };

  const type = event.eventType;
  const object = event.object ?? {};

  if (!type) {
    return NextResponse.json({ error: "Missing event type" }, { status: 400 });
  }

  if (type === "checkout.completed") {
    const metadata = eventMetadata(object.metadata);
    const subscription =
      object.subscription && typeof object.subscription === "object"
        ? (object.subscription as Record<string, unknown>)
        : null;
    const customer =
      object.customer && typeof object.customer === "object"
        ? (object.customer as Record<string, unknown>)
        : null;
    const userId =
      (metadata.userId as string | undefined) ||
      (await resolveUserIdFromEmail((customer?.email as string | undefined) ?? null));

    if (userId) {
      await upsertSubscriptionForUser(userId, {
        plan: ((metadata.plan as string | undefined) ?? "pro") as "free" | "pro" | "team",
        status: (subscription?.status as string | undefined) ?? "active",
        creem_customer_id: (customer?.id as string | undefined) ?? null,
        creem_subscription_id: (subscription?.id as string | undefined) ?? null,
        current_period_start:
          (subscription?.current_period_start_date as string | undefined) ?? null,
        current_period_end:
          (subscription?.current_period_end_date as string | undefined) ?? null,
      });
    }
  }

  if (
    type === "subscription.active" ||
    type === "subscription.canceled" ||
    type === "subscription.expired"
  ) {
    const metadata = eventMetadata(object.metadata);
    const customer =
      object.customer && typeof object.customer === "object"
        ? (object.customer as Record<string, unknown>)
        : null;
    const userId =
      (metadata.userId as string | undefined) ||
      (await resolveUserIdFromEmail((customer?.email as string | undefined) ?? null));

    if (userId) {
      await upsertSubscriptionForUser(userId, {
        plan: ((metadata.plan as string | undefined) ?? "pro") as "free" | "pro" | "team",
        status: (object.status as string | undefined) ?? type.replace("subscription.", ""),
        creem_customer_id: (customer?.id as string | undefined) ?? null,
        creem_subscription_id: (object.id as string | undefined) ?? null,
        current_period_start:
          (object.current_period_start_date as string | undefined) ?? null,
        current_period_end:
          (object.current_period_end_date as string | undefined) ?? null,
      });
    }
  }

  return NextResponse.json({ received: true });
}
