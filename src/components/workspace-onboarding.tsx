"use client";

import { ArrowRight, Check, Link2, MessageSquare, Package } from "lucide-react";
import { useTranslations } from "@/i18n/provider";
import type { LobsterOnboardingState, OnboardingStepView } from "@/lib/workspace";

interface WorkspaceOnboardingProps {
  lobsterName: string;
  steps: LobsterOnboardingState["steps"];
  onNavigate: (view: OnboardingStepView) => void;
  onSkip: () => void;
}

export function WorkspaceOnboarding({
  lobsterName,
  steps,
  onNavigate,
  onSkip,
}: WorkspaceOnboardingProps) {
  const t = useTranslations("workspace.onboarding");

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/6 bg-discord-light p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-foreground">
              {t("title", { name: lobsterName })}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-discord-muted">
              {t("description")}
            </p>
          </div>
          <div className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs font-semibold text-discord-muted">
            {t("steps")}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {[
            {
              key: "chat" as OnboardingStepView,
              title: t("items.chat.title"),
              description: t("items.chat.description"),
              icon: MessageSquare,
              emoji: "💬",
            },
            {
              key: "channels" as OnboardingStepView,
              title: t("items.channels.title"),
              description: t("items.channels.description"),
              icon: Link2,
              emoji: "🔗",
            },
            {
              key: "skills" as OnboardingStepView,
              title: t("items.skills.title"),
              description: t("items.skills.description"),
              icon: Package,
              emoji: "📦",
            },
          ].map((step) => (
            <button
              key={step.key}
              onClick={() => onNavigate(step.key)}
              className="flex w-full items-center gap-4 rounded-xl border border-white/6 bg-discord-mid p-4 text-left transition-colors hover:bg-white/[0.04]"
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                  steps[step.key]
                    ? "border-[#23a55a] bg-[#23a55a] text-white"
                    : "border-white/10 bg-black/10 text-transparent"
                }`}
              >
                <Check className="h-4 w-4" />
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-discord-blurple/20 text-discord-blurple">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {step.emoji} {step.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-discord-muted">
                  {step.description}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-discord-muted" />
            </button>
          ))}
        </div>

        <button
          onClick={onSkip}
          className="mt-5 text-sm text-discord-muted transition-colors hover:text-foreground"
        >
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
