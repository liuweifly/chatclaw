"use client";

import {
  Brain,
  CreditCard,
  House,
  Link2,
  MessageSquare,
  Package,
  Settings,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "@/i18n/provider";
import { useStore } from "@/lib/store";
import { pickUserAvatar, pickUserName } from "@/lib/supabase/shared";
import { cn } from "@/lib/utils";
import { getPrimaryAgent } from "@/lib/workspace";
import type { WorkspaceView } from "@/types";

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full border-2 border-discord-mid",
        connected ? "bg-discord-green" : "bg-discord-muted"
      )}
    />
  );
}

const NAV_ITEMS: Array<{
  id: WorkspaceView;
  emoji: string;
  icon: typeof House;
}> = [
  { id: "overview", emoji: "🏠", icon: House },
  { id: "chat", emoji: "💬", icon: MessageSquare },
  { id: "channels", emoji: "🔗", icon: Link2 },
  { id: "skills", emoji: "📦", icon: Package },
  { id: "memory", emoji: "🧠", icon: Brain },
  { id: "pricing", emoji: "💳", icon: CreditCard },
  { id: "settings", emoji: "⚙️", icon: Settings },
];

export function NavigationPanel() {
  const t = useTranslations("workspace");
  const commonT = useTranslations("common");
  const { user, profile, subscription } = useAuth();
  const { state, actions } = useStore();

  const activeCompany = state.companies.find((company) => company.id === state.activeCompanyId);
  const primaryAgent = getPrimaryAgent(state);
  const isConnected = state.connectionStatus === "connected";
  const userName = user || profile ? pickUserName(user, profile) : commonT("operator");
  const userAvatar = pickUserAvatar(user, profile);

  if (!activeCompany) {
    return (
      <div className="flex h-full w-64 flex-col items-center justify-center bg-discord-mid px-6 text-center text-sm text-discord-muted">
        {t("empty")}
      </div>
    );
  }

  const openView = (view: WorkspaceView) => {
    if (view === "chat" && primaryAgent) {
      void actions.selectChatTarget({ type: "agent", id: primaryAgent.id });
      return;
    }

    actions.setActiveView(view);
  };

  return (
    <div className="flex h-full w-64 flex-col bg-discord-mid">
      <div className="border-b border-white/6 p-3">
        <button
          onClick={() => actions.setActiveView("overview")}
          className="flex w-full items-center gap-3 rounded-xl border border-white/6 bg-black/10 p-3 text-left transition-colors hover:bg-white/[0.04]"
        >
          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-discord-blurple text-xl text-white">
              🦞
            </div>
            <div className="absolute -bottom-0.5 -right-0.5">
              <ConnectionDot connected={isConnected} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-sidebar-primary">
              {primaryAgent?.name || t("sidebar.defaultLobster")}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-discord-muted">
              <span>{isConnected ? commonT("online") : commonT("offline")}</span>
              <span className="text-white/15">•</span>
              <span className="truncate">
                {primaryAgent ? t("sidebar.personalWorkspace") : t("sidebar.createFirstLobster")}
              </span>
            </div>
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = state.activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => openView(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-discord-blurple text-white"
                    : "text-discord-muted hover:bg-white/[0.04] hover:text-sidebar-primary"
                )}
              >
                <span className="text-base leading-none">{item.emoji}</span>
                <span className="flex-1 text-left">{t(`nav.${item.id}`)}</span>
                <Icon className="h-4 w-4 opacity-60" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/6 p-3">
        <div className="mt-3 rounded-xl border border-white/6 bg-black/10 p-3">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={userAvatar ?? undefined} alt={userName} />
              <AvatarFallback>{userName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-primary">{userName}</p>
              <p className="truncate text-[11px] text-discord-muted">
                {commonT(subscription?.plan ?? "free")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
