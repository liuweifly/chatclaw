"use client";

import {
  ArrowRight,
  Brain,
  Link2,
  Package,
} from "lucide-react";
import { useLocale, useTranslations } from "@/i18n/provider";
import { useStore } from "@/lib/store";
import { CAPABILITIES } from "@/components/lobster-dashboard";
import { cn } from "@/lib/utils";
import { getAgentRoleKey, getPrimaryAgent } from "@/lib/workspace";
import type { WorkspaceView } from "@/types";

export function LobsterOverview({ onNavigate }: { onNavigate: (view: WorkspaceView) => void }) {
  const t = useTranslations("workspace.overview");
  const workspaceT = useTranslations("workspace");
  const locale = useLocale();
  const { state } = useStore();
  const primaryAgent = getPrimaryAgent(state);
  const isConnected = state.connectionStatus === "connected";
  const activeCapabilities = CAPABILITIES.filter((capability) => capability.active);
  const createdAt = primaryAgent ? new Date(primaryAgent.createdAt) : null;
  const now = new Date();
  const isCreatedToday = createdAt
    ? createdAt.getFullYear() === now.getFullYear() &&
      createdAt.getMonth() === now.getMonth() &&
      createdAt.getDate() === now.getDate()
    : false;
  const createdLabel =
    isCreatedToday
      ? t("createdToday")
      : createdAt
      ? t("createdOn", {
          date: new Intl.DateTimeFormat(locale).format(createdAt),
        })
      : t("createToBegin");

  if (!primaryAgent) {
    return (
      <div className="flex h-full flex-col bg-discord-light">
        <div className="border-b border-white/6 px-6 py-5">
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-discord-muted">
            {t("emptyDescription")}
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-xl border border-white/6 bg-discord-mid p-6 text-center">
            <div className="text-4xl">🦞</div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              {t("emptyTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-discord-muted">
              {t("emptyBody")}
            </p>
            <button
              onClick={() => onNavigate("chat")}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-discord-blurple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-discord-blurple/85"
            >
              {t("openChat")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-discord-light">
      <div className="border-b border-white/6 px-6 py-5">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-discord-muted">
          {t("description")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-xl border border-white/6 bg-discord-mid p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-discord-blurple text-2xl">
                🦞
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-foreground">
                    {primaryAgent.name}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      isConnected
                        ? "bg-[#23a55a]/20 text-[#23a55a]"
                        : "bg-white/10 text-discord-muted"
                    )}
                  >
                    {isConnected ? t("online") : t("offline")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-discord-muted">
                  {t("roleLabel", {
                    role: workspaceT(`roles.${getAgentRoleKey(primaryAgent.specialty)}`),
                  })}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/6 bg-black/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-discord-muted">
                      {t("stats.status")}
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {isConnected ? t("stats.connected") : t("stats.waiting")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-black/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-discord-muted">
                      {t("stats.timeline")}
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">{createdLabel}</p>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-black/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-discord-muted">
                      {t("stats.chats")}
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">{t("stats.syncing")}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-white/6 bg-discord-mid p-6">
            <h2 className="text-lg font-semibold text-foreground">{t("quickActions.title")}</h2>
            <p className="mt-1 text-sm text-discord-muted">
              {t("quickActions.description")}
            </p>
            <div className="mt-5 space-y-3">
              {[
                {
                  title: t("quickActions.items.channels.title"),
                  description: t("quickActions.items.channels.description"),
                  icon: Link2,
                  view: "channels" as WorkspaceView,
                },
                {
                  title: t("quickActions.items.skills.title"),
                  description: t("quickActions.items.skills.description"),
                  icon: Package,
                  view: "skills" as WorkspaceView,
                },
                {
                  title: t("quickActions.items.memory.title"),
                  description: t("quickActions.items.memory.description"),
                  icon: Brain,
                  view: "memory" as WorkspaceView,
                },
              ].map((item) => (
                <button
                  key={item.title}
                  onClick={() => onNavigate(item.view)}
                  className="flex w-full items-center gap-4 rounded-xl border border-white/6 bg-black/10 p-4 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-discord-blurple/20 text-discord-blurple">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-discord-muted">
                      {item.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-discord-muted" />
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-white/6 bg-discord-mid p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("capabilities.title")}</h2>
              <p className="mt-1 text-sm text-discord-muted">
                {t("capabilities.description")}
              </p>
            </div>
            <span className="rounded-full bg-discord-blurple/20 px-2.5 py-1 text-[11px] font-semibold text-discord-blurple">
              {t("capabilities.activeCount", { count: activeCapabilities.length })}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {activeCapabilities.map((capability) => (
              <div
                key={capability.key}
                className="rounded-xl border border-white/6 bg-black/10 p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-discord-blurple/20 text-discord-blurple">
                  <capability.icon className="h-4 w-4" />
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {t(`capabilities.items.${capability.key}.name`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-discord-muted">
                  {t(`capabilities.items.${capability.key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
