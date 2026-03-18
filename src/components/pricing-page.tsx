"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/provider";
import type { BillingPlan } from "@/lib/billing";
import { cn } from "@/lib/utils";

const PLAN_ORDER: BillingPlan[] = ["free", "pro", "team"];

export function PricingPage({
  embedded = false,
  onRequireAuth,
}: {
  embedded?: boolean;
  onRequireAuth?: () => void;
}) {
  const t = useTranslations("pricing");
  const { user, subscription, refreshAccount } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<BillingPlan | null>(null);

  const currentPlan = (subscription?.plan ?? "free") as BillingPlan;

  async function handleCheckout(plan: BillingPlan) {
    if (plan === "free") {
      return;
    }

    if (!user) {
      onRequireAuth?.();
      return;
    }

    setLoadingPlan(plan);

    try {
      const response = await fetch("/api/creem/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Checkout failed");
      }
      window.location.href = payload.url;
    } finally {
      setLoadingPlan(null);
      void refreshAccount();
    }
  }

  return (
    <div className={cn("space-y-6", embedded ? "" : "bg-discord-light p-6")}>
      {!embedded && (
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
            <Sparkles className="h-3.5 w-3.5 text-discord-blurple" />
            {t("eyebrow")}
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-discord-muted">
            {t("description")}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((plan) => {
          const isCurrent = currentPlan === plan;
          const isPaid = plan !== "free";
          return (
            <div
              key={plan}
              className={cn(
                "rounded-2xl border p-5",
                plan === "pro"
                  ? "border-discord-blurple/60 bg-discord-mid shadow-[0_24px_60px_rgba(88,101,242,0.15)]"
                  : "border-white/6 bg-discord-mid"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {t(`${plan}.name`)}
                  </h2>
                  <p className="mt-1 text-sm text-discord-muted">{t(`${plan}.summary`)}</p>
                </div>
                {plan === "pro" && (
                  <span className="rounded-full bg-discord-blurple/20 px-2.5 py-1 text-[11px] font-semibold text-discord-blurple">
                    {t("popular")}
                  </span>
                )}
              </div>

              <div className="mt-6 flex items-end gap-1">
                <span className="text-3xl font-semibold text-foreground">
                  {plan === "free" ? "$0" : "$9"}
                </span>
                <span className="pb-1 text-sm text-discord-muted">
                  {plan === "free" ? t("forever") : t("perMonth")}
                </span>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-discord-muted">
                {[0, 1, 2, 3].map((index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-discord-green" />
                    <span>{t(`${plan}.features.${index}`)}</span>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                onClick={() => void handleCheckout(plan)}
                disabled={isCurrent || loadingPlan === plan}
                className={cn(
                  "mt-6 w-full",
                  isPaid
                    ? "bg-discord-blurple text-white hover:bg-discord-blurple/85"
                    : "bg-discord-dark text-foreground hover:bg-discord-darker"
                )}
              >
                {loadingPlan === plan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCurrent ? t("currentPlan") : t(`${plan}.cta`)}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
