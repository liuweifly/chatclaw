"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Brain,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  ImageIcon,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ChannelConnectDialog } from "@/components/channel-connect-dialog";
import type {
  ChannelKey,
  ChannelSummary,
} from "@/lib/channel-integrations";
import type {
  LobsterWorkspaceResponse,
  LobsterWorkspaceSkill,
} from "@/lib/lobster-workspace";
import { useLocale, useTranslations } from "@/i18n/provider";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { getPrimaryAgent } from "@/lib/workspace";

const CHANNEL_CARD_META: Record<ChannelKey, { icon: string }> = {
  web: { icon: "🌐" },
  telegram: { icon: "✈️" },
  feishu: { icon: "🐦" },
  discord: { icon: "🎮" },
  slack: { icon: "💬" },
};

export const CAPABILITIES = [
  { key: "browsing", active: true, icon: Search },
  { key: "files", active: true, icon: FileText },
  { key: "code", active: true, icon: Wrench },
  { key: "messaging", active: true, icon: Send },
  { key: "scheduled", active: true, icon: Bot },
  { key: "image", active: true, icon: ImageIcon },
  { key: "pdf", active: true, icon: Globe },
  { key: "email", active: false, icon: Mail },
];

export function ChannelsPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const t = useTranslations("workspace.panels.channels");
  const { state } = useStore();
  const searchParams = useSearchParams();
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<"telegram" | "feishu" | null>(null);
  const [pendingAction, setPendingAction] = useState<"connect" | "disconnect" | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    if (!state.activeCompanyId) {
      setChannels([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${state.activeCompanyId}/channels`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | { channels: ChannelSummary[]; error?: string }
        | { error?: string };

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, "Could not load channels"));
      }

      setChannels("channels" in payload && Array.isArray(payload.channels) ? payload.channels : []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load channels");
    } finally {
      setLoading(false);
    }
  }, [state.activeCompanyId]);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const selectedIntegration =
    channels.find((channel) => channel.key === selectedChannel) ?? null;
  const callbackChannel = searchParams.get("channel");
  const callbackStatus = searchParams.get("status");
  const callbackMessage = searchParams.get("message");

  const connectTelegram = useCallback(
    async (token: string) => {
      if (!state.activeCompanyId) {
        return;
      }

      setPendingAction("connect");
      setMutationError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${state.activeCompanyId}/channels/telegram/connect`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }
        );
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(extractErrorMessage(payload, "Could not connect Telegram"));
        }

        await loadChannels();
      } catch (caughtError) {
        setMutationError(
          caughtError instanceof Error ? caughtError.message : "Could not connect Telegram"
        );
      } finally {
        setPendingAction(null);
      }
    },
    [loadChannels, state.activeCompanyId]
  );

  const startFeishu = useCallback(async () => {
    if (!state.activeCompanyId) {
      return;
    }

    setPendingAction("connect");
    setMutationError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${state.activeCompanyId}/channels/feishu/connect`,
        {
          method: "POST",
        }
      );
      const payload = (await response.json()) as { connectUrl?: string; error?: string };

      if (!response.ok || !payload.connectUrl) {
        throw new Error(extractErrorMessage(payload, "Could not start Feishu install"));
      }

      await loadChannels();
      window.open(payload.connectUrl, "_blank", "noopener,noreferrer");
    } catch (caughtError) {
      setMutationError(
        caughtError instanceof Error ? caughtError.message : "Could not start Feishu install"
      );
    } finally {
      setPendingAction(null);
    }
  }, [loadChannels, state.activeCompanyId]);

  const disconnectSelected = useCallback(async () => {
    if (!state.activeCompanyId || !selectedIntegration?.id) {
      return;
    }

    setPendingAction("disconnect");
    setMutationError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${state.activeCompanyId}/channels/${selectedIntegration.id}`,
        {
          method: "DELETE",
        }
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, "Could not disconnect channel"));
      }

      await loadChannels();
    } catch (caughtError) {
      setMutationError(
        caughtError instanceof Error ? caughtError.message : "Could not disconnect channel"
      );
    } finally {
      setPendingAction(null);
    }
  }, [loadChannels, selectedIntegration?.id, state.activeCompanyId]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{t("subtitle")}</p>
          <p className="mt-1 text-xs text-discord-muted">{t("helper")}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadChannels()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-discord-dark px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-discord-darker disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          {t("refresh")}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-discord-red/30 bg-discord-red/10 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-discord-red" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("loadFailed")}</p>
            <p className="mt-1 text-sm leading-6 text-discord-muted">{error}</p>
          </div>
        </div>
      )}

      {callbackChannel && callbackStatus && (
        <div
          className={cn(
            "mb-4 flex items-start gap-3 rounded-xl border p-4",
            callbackStatus === "connected" &&
              "border-[#23a55a]/30 bg-[#23a55a]/10",
            callbackStatus !== "connected" &&
              "border-[#f0b232]/30 bg-[#f0b232]/10"
          )}
        >
          {callbackStatus === "connected" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#23a55a]" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#f0b232]" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {callbackStatus === "connected"
                ? t("callbackSuccess", {
                    channel: t(`items.${callbackChannel}.name`),
                  })
                : t("callbackActionRequired", {
                    channel: t(`items.${callbackChannel}.name`),
                  })}
            </p>
            {callbackMessage && (
              <p className="mt-1 text-sm leading-6 text-discord-muted">{callbackMessage}</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {channels.map((channel) => (
          <div
            key={channel.key}
            className="flex items-center gap-3 rounded-xl border border-white/6 bg-discord-mid p-3"
          >
            <span className="text-xl">{CHANNEL_CARD_META[channel.key].icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {t(`items.${channel.key}.name`)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    channel.status === "connected" && "bg-[#23a55a]/20 text-[#23a55a]",
                    channel.status === "not_connected" &&
                      "bg-discord-blurple/20 text-discord-blurple",
                    channel.status === "action_required" &&
                      "bg-[#f0b232]/20 text-[#f0b232]",
                    channel.status === "error" && "bg-discord-red/20 text-discord-red",
                    channel.status === "coming_soon" && "bg-white/10 text-discord-muted"
                  )}
                >
                  {t(`statuses.${channel.status}`)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-discord-muted">
                {t(`items.${channel.key}.description`)}
              </p>
              {(channel.accountLabel || channel.details || channel.lastError) && (
                <p className="mt-2 text-xs text-discord-muted">
                  {channel.lastError ||
                    channel.accountLabel ||
                    channel.details}
                </p>
              )}
            </div>
            {channel.connectMode !== "none" && (
              <button
                type="button"
                onClick={() => {
                  if (channel.key === "telegram" || channel.key === "feishu") {
                    setSelectedChannel(channel.key);
                  }
                }}
                disabled={loading}
                className="shrink-0 rounded-lg bg-discord-blurple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-discord-blurple/80 disabled:opacity-60"
              >
                {channel.status === "connected"
                  ? t("manage")
                  : channel.status === "error"
                    ? t("reconnect")
                    : channel.status === "action_required"
                      ? t("continue")
                      : t("connect")}
              </button>
            )}
          </div>
        ))}
      </div>

      <ChannelConnectDialog
        channel={selectedChannel}
        open={selectedChannel !== null}
        integration={selectedIntegration}
        pending={pendingAction}
        error={mutationError}
        onConnectTelegram={connectTelegram}
        onStartFeishu={startFeishu}
        onDisconnect={disconnectSelected}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedChannel(null);
            setMutationError(null);
          }
        }}
        onOpenSettings={onOpenSettings}
      />
    </>
  );
}

function formatDateTime(locale: string, value: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function trimPreview(value: string | null) {
  if (!value) {
    return null;
  }

  return value.length > 220 ? `${value.slice(0, 217)}...` : value;
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }

  return fallback;
}

function isWorkspaceResponse(payload: unknown): payload is LobsterWorkspaceResponse {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "snapshot" in payload &&
      (payload as { snapshot?: unknown }).snapshot
  );
}

function preserveSkillOrder(
  previous: LobsterWorkspaceResponse["snapshot"] | null,
  next: LobsterWorkspaceResponse["snapshot"] | null
) {
  if (!next || !previous?.skills.length) {
    return next;
  }

  const previousOrder = new Map(previous.skills.map((skill, index) => [skill.id, index]));
  const orderedSkills = [...next.skills].sort((left, right) => {
    const leftIndex = previousOrder.get(left.id);
    const rightIndex = previousOrder.get(right.id);

    if (leftIndex === undefined && rightIndex === undefined) {
      return 0;
    }
    if (leftIndex === undefined) {
      return 1;
    }
    if (rightIndex === undefined) {
      return -1;
    }
    return leftIndex - rightIndex;
  });

  return {
    ...next,
    skills: orderedSkills,
  };
}

function useWorkspaceSnapshot() {
  const t = useTranslations("workspace.panels.skills");
  const { state } = useStore();
  const companyId = state.activeCompanyId;
  const primaryAgent = getPrimaryAgent(state);
  const [snapshot, setSnapshot] = useState<LobsterWorkspaceResponse["snapshot"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);

  const loadSnapshot = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId || !primaryAgent) {
        setSnapshot(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await fetch(`/api/lobsters/${companyId}/workspace`, {
          cache: "no-store",
          signal,
        });
        const payload = (await response.json()) as LobsterWorkspaceResponse | { error?: string };

        if (!response.ok) {
          throw new Error(extractErrorMessage(payload, "Could not load workspace data"));
        }

        if (!signal?.aborted) {
          const nextSnapshot = isWorkspaceResponse(payload) ? payload.snapshot : null;
          setSnapshot((current) => preserveSkillOrder(current, nextSnapshot));
        }
      } catch (caughtError) {
        if (signal?.aborted) {
          return;
        }

        setError(
          caughtError instanceof Error ? caughtError.message : "Could not load workspace data"
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [companyId, primaryAgent]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadSnapshot(controller.signal);
    return () => controller.abort();
  }, [loadSnapshot]);

  const installSkill = useCallback(
    async (skillId: string) => {
      if (!companyId) {
        return;
      }

      setInstallingSkillId(skillId);
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await fetch(`/api/lobsters/${companyId}/workspace`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "installSkill",
            skillId,
          }),
        });
        const payload = (await response.json()) as LobsterWorkspaceResponse | { error?: string };

        if (!response.ok) {
          throw new Error(extractErrorMessage(payload, "Could not install skill"));
        }

        const nextSnapshot = isWorkspaceResponse(payload) ? payload.snapshot : null;
        setSnapshot((current) => preserveSkillOrder(current, nextSnapshot));
        setSuccessMessage(t("installSuccess"));
      } catch (caughtError) {
        setSuccessMessage(null);
        setError(caughtError instanceof Error ? caughtError.message : "Could not install skill");
      } finally {
        setInstallingSkillId(null);
      }
    },
    [companyId, t]
  );

  return {
    primaryAgent,
    snapshot,
    loading,
    error,
    successMessage,
    installingSkillId,
    reload: () => loadSnapshot(),
    installSkill,
  };
}

function PanelState({
  title,
  actionLabel,
  loading = false,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  loading?: boolean;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-5 text-center">
      <div className="flex justify-center">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-discord-blurple" />
        ) : (
          <Brain className="h-4 w-4 text-discord-blurple" />
        )}
      </div>
      <p className="mt-3 text-sm text-discord-muted">{title}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function WorkspaceMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/10 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-discord-muted">{label}</p>
      <p className="mt-2 break-all text-xs leading-5 text-foreground">{value}</p>
    </div>
  );
}

function WorkspaceLinkMeta({
  label,
  href,
  fallback,
  actionLabel,
}: {
  label: string;
  href?: string | null;
  fallback: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/10 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-discord-muted">{label}</p>
      {href ? (
        <>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all text-xs leading-5 text-discord-blurple transition-colors hover:underline"
          >
            {href}
          </a>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/10"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {actionLabel}
          </a>
        </>
      ) : (
        <p className="mt-2 text-xs leading-5 text-discord-muted">{fallback}</p>
      )}
    </div>
  );
}

export function MemoryPanel() {
  const t = useTranslations("workspace.panels.memory");
  const locale = useLocale();
  const { primaryAgent, snapshot, loading, error, reload } = useWorkspaceSnapshot();

  if (!primaryAgent) {
    return <PanelState title={t("selectLobster")} />;
  }

  if (loading && !snapshot) {
    return <PanelState title={t("loading")} loading />;
  }

  if (error && !snapshot) {
    return <PanelState title={error} actionLabel={t("retry")} onAction={reload} />;
  }

  const memoryEntries = snapshot?.memoryEntries ?? [];
  const sessions = snapshot?.sessions ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_auto]">
        <WorkspaceMeta label={t("workspaceLabel")} value={snapshot?.workspaceDir ?? "-"} />
        <WorkspaceMeta
          label={t("statsLabel")}
          value={t("statsValue", {
            memories: memoryEntries.length,
            sessions: sessions.length,
          })}
        />
        <WorkspaceLinkMeta
          label={t("dashboardLabel")}
          href={snapshot?.dashboardUrl}
          fallback={t("dashboardUnavailable")}
          actionLabel={t("openDashboard")}
        />
        <div className="flex items-start justify-end">
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("retry")}
          </button>
        </div>
      </div>

      {error && snapshot && (
        <div className="rounded-xl border border-[#f0b232]/20 bg-[#f0b232]/10 p-3 text-xs text-[#f0b232]">
          {error}
        </div>
      )}

      {sessions.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("sessionsTitle")}</h2>
            <p className="mt-1 text-xs text-discord-muted">{t("sessionsDescription")}</p>
          </div>
          {sessions.map((session) => (
            <div
              key={session.id}
              className="rounded-xl border border-white/6 bg-discord-mid p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-discord-blurple/20 px-2 py-0.5 text-[10px] font-semibold text-discord-blurple">
                  {session.source || t("sessionFallback")}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-discord-muted">
                  {session.chatType || t("sessionUnknownType")}
                </span>
                <span className="text-[11px] text-discord-muted">
                  {formatDateTime(locale, session.updatedAt)}
                </span>
              </div>
              {session.originLabel && (
                <p className="mt-2 text-xs text-discord-muted">{session.originLabel}</p>
              )}
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-discord-muted">
                {t("sessionCount", { count: session.messageCount })}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ConversationPreview
                  label={t("lastUser")}
                  value={session.lastUserMessage}
                />
                <ConversationPreview
                  label={t("lastAssistant")}
                  value={session.lastAssistantMessage}
                />
              </div>
            </div>
          ))}
        </section>
      )}

      {memoryEntries.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("filesTitle")}</h2>
            <p className="mt-1 text-xs text-discord-muted">{t("filesDescription")}</p>
          </div>
          {memoryEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-white/6 bg-discord-mid p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    entry.kind === "long_term"
                      ? "bg-discord-blurple/20 text-discord-blurple"
                      : "bg-white/10 text-discord-muted"
                  )}
                >
                  {entry.kind === "long_term" ? t("longTerm") : t("note")}
                </span>
                <span className="text-sm font-medium text-foreground">{entry.name}</span>
                <span className="text-[11px] text-discord-muted">
                  {formatDateTime(locale, entry.updatedAt)}
                </span>
              </div>
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-discord-muted">
                {entry.relativePath} · {formatBytes(entry.size)}
              </p>
              <p className="mt-3 text-xs leading-5 text-discord-muted">
                {trimPreview(entry.preview) || t("noPreview")}
              </p>
            </div>
          ))}
        </section>
      )}

      {!loading && memoryEntries.length === 0 && sessions.length === 0 && (
        <PanelState title={t("empty")} actionLabel={t("retry")} onAction={reload} />
      )}
    </div>
  );
}

export function CapabilitiesPanel() {
  const t = useTranslations("workspace.panels.capabilities");

  return (
    <div className="space-y-3">
      {CAPABILITIES.map((capability) => (
        <div
          key={capability.key}
          className="flex items-center gap-3 rounded-xl border border-white/6 bg-discord-mid p-3"
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              capability.active ? "bg-[#23a55a]/20" : "bg-white/5"
            )}
          >
            <capability.icon
              className={cn(
                "h-4 w-4",
                capability.active ? "text-[#23a55a]" : "text-discord-muted"
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {t(`items.${capability.key}.name`)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  capability.active
                    ? "bg-[#23a55a]/20 text-[#23a55a]"
                    : "bg-white/10 text-discord-muted"
                )}
              >
                {capability.active ? t("active") : t("inactive")}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-discord-muted">
              {t(`items.${capability.key}.description`)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkillsPanel() {
  const t = useTranslations("workspace.panels.skills");
  const {
    primaryAgent,
    snapshot,
    loading,
    error,
    successMessage,
    installingSkillId,
    reload,
    installSkill,
  } = useWorkspaceSnapshot();

  if (!primaryAgent) {
    return <PanelState title={t("selectLobster")} />;
  }

  if (loading && !snapshot) {
    return <PanelState title={t("loading")} loading />;
  }

  if (error && !snapshot) {
    return <PanelState title={error} actionLabel={t("retry")} onAction={reload} />;
  }

  const skills = snapshot?.skills ?? [];
  const installedCount = skills.filter((skill) => skill.installed).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_auto]">
        <WorkspaceMeta label={t("workspaceLabel")} value={snapshot?.workspaceDir ?? "-"} />
        <WorkspaceMeta
          label={t("statsLabel")}
          value={t("statsValue", {
            installed: installedCount,
            total: skills.length,
          })}
        />
        <WorkspaceLinkMeta
          label={t("dashboardLabel")}
          href={snapshot?.dashboardUrl}
          fallback={t("dashboardUnavailable")}
          actionLabel={t("openDashboard")}
        />
        <div className="flex items-start justify-end">
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("retry")}
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-xl border border-[#23a55a]/20 bg-[#23a55a]/10 p-3 text-xs text-[#23a55a]">
          {successMessage}
        </div>
      )}

      {error && snapshot && (
        <div className="rounded-xl border border-[#f0b232]/20 bg-[#f0b232]/10 p-3 text-xs text-[#f0b232]">
          {error}
        </div>
      )}

      {skills.length > 0 ? (
        <div className="space-y-3">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installing={installingSkillId === skill.id}
              onInstall={() => installSkill(skill.id)}
            />
          ))}
        </div>
      ) : (
        <PanelState title={t("empty")} actionLabel={t("retry")} onAction={reload} />
      )}

      <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-4">
        <p className="text-xs leading-5 text-discord-muted">{t("footer")}</p>
      </div>
    </div>
  );
}

function ConversationPreview({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/10 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-discord-muted">{label}</p>
      <p className="mt-2 text-xs leading-5 text-foreground">{trimPreview(value) || "-"}</p>
    </div>
  );
}

function sourceKey(source: LobsterWorkspaceSkill["source"]) {
  switch (source) {
    case "bundled":
      return "bundled";
    case "custom":
      return "custom";
    case "curated":
      return "curated";
    case "runtime":
    default:
      return "runtime";
  }
}

function SkillCard({
  skill,
  installing,
  onInstall,
}: {
  skill: LobsterWorkspaceSkill;
  installing: boolean;
  onInstall: () => void;
}) {
  const t = useTranslations("workspace.panels.skills");

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/6 bg-discord-mid p-4">
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          skill.installed ? "bg-discord-blurple/20" : "bg-white/5"
        )}
      >
        <Sparkles
          className={cn("h-4 w-4", skill.installed ? "text-discord-blurple" : "text-discord-muted")}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{skill.name}</span>
          {skill.active && (
            <span className="rounded-full bg-[#23a55a]/20 px-2 py-0.5 text-[10px] font-semibold text-[#23a55a]">
              {t("active")}
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              skill.installed
                ? "bg-discord-blurple/20 text-discord-blurple"
                : "bg-white/10 text-discord-muted"
            )}
          >
            {skill.installed ? t("installed") : t("available")}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-discord-muted">
            {t(`sources.${sourceKey(skill.source)}`)}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-discord-muted">
          {skill.description || t("noDescription")}
        </p>
        {skill.location && (
          <p className="mt-2 break-all text-[11px] text-discord-muted">{skill.location}</p>
        )}
      </div>
      {!skill.installed && skill.installable && (
        <button
          type="button"
          disabled={installing}
          onClick={onInstall}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-discord-blurple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-discord-blurple/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {installing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {installing ? t("installing") : t("install")}
        </button>
      )}
    </div>
  );
}
