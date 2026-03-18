"use client";

import {
  Brain,
  Bot,
  FileText,
  Globe,
  ImageIcon,
  Mail,
  Search,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useTranslations } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export const CHANNELS = [
  { key: "web", status: "connected" as const, icon: "🌐" },
  { key: "telegram", status: "available" as const, icon: "✈️" },
  { key: "feishu", status: "available" as const, icon: "🐦" },
  { key: "discord", status: "available" as const, icon: "🎮" },
  { key: "slack", status: "coming_soon" as const, icon: "💬" },
];

export const MEMORY_ITEMS = [
  "longTerm",
  "dailyNotes",
  "profile",
  "projects",
] as const;

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

export const SKILLS = [
  { key: "github", installed: true },
  { key: "googleWorkspace", installed: true },
  { key: "weather", installed: true },
  { key: "webSearch", installed: true },
  { key: "codingAgent", installed: true },
  { key: "seo", installed: false },
  { key: "notion", installed: false },
  { key: "analytics", installed: false },
];

export function ChannelsPanel() {
  const t = useTranslations("workspace.panels.channels");

  return (
    <div className="space-y-3">
      {CHANNELS.map((channel) => (
        <div
          key={channel.key}
          className="flex items-center gap-3 rounded-xl border border-white/6 bg-discord-mid p-3"
        >
          <span className="text-xl">{channel.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {t(`items.${channel.key}.name`)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  channel.status === "connected" && "bg-[#23a55a]/20 text-[#23a55a]",
                  channel.status === "available" &&
                    "bg-discord-blurple/20 text-discord-blurple",
                  channel.status === "coming_soon" && "bg-white/10 text-discord-muted"
                )}
              >
                {t(`statuses.${channel.status}`)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-discord-muted">
              {t(`items.${channel.key}.description`)}
            </p>
          </div>
          {channel.status === "available" && (
            <button className="shrink-0 rounded-lg bg-discord-blurple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-discord-blurple/80">
              {t("connect")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function MemoryPanel() {
  const t = useTranslations("workspace.panels.memory");

  return (
    <div className="space-y-3">
      {MEMORY_ITEMS.map((item) => (
        <div
          key={item}
          className="rounded-xl border border-white/6 bg-discord-mid p-3"
        >
          <div className="mb-1 flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-discord-blurple" />
            <span className="text-sm font-medium text-foreground">{t(`items.${item}.title`)}</span>
          </div>
          <p className="text-xs leading-5 text-discord-muted">{t(`items.${item}.description`)}</p>
        </div>
      ))}
      <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/10 p-4 text-center">
        <p className="text-xs text-discord-muted">{t("footer")}</p>
      </div>
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

  return (
    <div className="space-y-3">
      {SKILLS.map((skill) => (
        <div
          key={skill.key}
          className="flex items-center gap-3 rounded-xl border border-white/6 bg-discord-mid p-3"
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              skill.installed ? "bg-discord-blurple/20" : "bg-white/5"
            )}
          >
            <Sparkles
              className={cn(
                "h-4 w-4",
                skill.installed ? "text-discord-blurple" : "text-discord-muted"
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {t(`items.${skill.key}.name`)}
              </span>
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
            </div>
            <p className="mt-0.5 text-xs text-discord-muted">
              {t(`items.${skill.key}.description`)}
            </p>
          </div>
          {!skill.installed && (
            <button className="shrink-0 rounded-lg bg-discord-blurple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-discord-blurple/80">
              {t("install")}
            </button>
          )}
        </div>
      ))}
      <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/10 p-4 text-center">
        <p className="text-xs text-discord-muted">
          {t("footerPrefix")}{" "}
          <a
            href="https://clawhub.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-discord-blurple hover:underline"
          >
            clawhub.com
          </a>
        </p>
      </div>
    </div>
  );
}
