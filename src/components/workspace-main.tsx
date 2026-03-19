"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Bot, Brain, CreditCard, Link2, Package } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ChatArea } from "@/components/chat-area";
import {
  ChannelsPanel,
  MemoryPanel,
  SkillsPanel,
} from "@/components/lobster-dashboard";
import { LobsterOverview } from "@/components/lobster-overview";
import { PricingPage } from "@/components/pricing-page";
import { SettingsPage as WorkspaceSettingsPage } from "@/components/settings-page";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";
import { useTranslations } from "@/i18n/provider";
import { useStore } from "@/lib/store";
import {
  dismissOnboarding,
  getPrimaryAgent,
  markOnboardingStep,
  readOnboardingState,
  subscribeOnboarding,
  type LobsterOnboardingState,
  type OnboardingStepView,
} from "@/lib/workspace";
import type { WorkspaceView } from "@/types";

function WorkspacePage({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Bot;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-discord-light">
      <div className="border-b border-white/6 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-discord-mid text-discord-blurple">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-discord-muted">{description}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}

export function WorkspaceMain() {
  const t = useTranslations("workspace");
  const { state, actions } = useStore();
  const searchParams = useSearchParams();
  const handledChannelRedirect = useRef<string | null>(null);
  const primaryAgent = getPrimaryAgent(state);
  const onboardingState = useSyncExternalStore(
    subscribeOnboarding,
    () => (primaryAgent ? readOnboardingState(primaryAgent.id) : null),
    () => null as LobsterOnboardingState | null
  );

  useEffect(() => {
    if (!primaryAgent || !onboardingState || onboardingState.dismissed) {
      return;
    }

    const onboardingView =
      state.activeView === "chat" ||
      state.activeView === "channels" ||
      state.activeView === "skills"
        ? state.activeView
        : null;

    if (!onboardingView || onboardingState.steps[onboardingView]) {
      return;
    }

    markOnboardingStep(primaryAgent.id, onboardingView);
  }, [onboardingState, primaryAgent, state.activeView]);

  useEffect(() => {
    if (!primaryAgent || !onboardingState || onboardingState.dismissed) {
      return;
    }

    if (Object.values(onboardingState.steps).every(Boolean)) {
      dismissOnboarding(primaryAgent.id);
    }
  }, [onboardingState, primaryAgent]);

  useEffect(() => {
    const channel = searchParams.get("channel");
    const status = searchParams.get("status");
    const signature = channel && status ? `${channel}:${status}` : null;

    if (!signature || handledChannelRedirect.current === signature) {
      return;
    }

    if (channel === "telegram" || channel === "feishu") {
      handledChannelRedirect.current = signature;
      actions.setActiveView("channels");
    }
  }, [actions, searchParams]);

  const navigateToView = (view: WorkspaceView) => {
    if (view === "chat" && primaryAgent) {
      void actions.selectChatTarget({ type: "agent", id: primaryAgent.id });
      return;
    }

    actions.setActiveView(view);
  };

  const navigateOnboarding = (view: OnboardingStepView) => {
    navigateToView(view);
  };

  let content: ReactNode;
  switch (state.activeView) {
    case "overview":
      content = <LobsterOverview onNavigate={navigateToView} />;
      break;
    case "channels":
      content = (
        <WorkspacePage
          title={t("views.channels.title")}
          description={t("views.channels.description")}
          icon={Link2}
        >
          <ChannelsPanel onOpenSettings={() => navigateToView("settings")} />
        </WorkspacePage>
      );
      break;
    case "skills":
      content = (
        <WorkspacePage
          title={t("views.skills.title")}
          description={t("views.skills.description")}
          icon={Package}
        >
          <SkillsPanel />
        </WorkspacePage>
      );
      break;
    case "memory":
      content = (
        <WorkspacePage
          title={t("views.memory.title")}
          description={t("views.memory.description")}
          icon={Brain}
        >
          <MemoryPanel />
        </WorkspacePage>
      );
      break;
    case "pricing":
      content = (
        <WorkspacePage
          title={t("views.pricing.title")}
          description={t("views.pricing.description")}
          icon={CreditCard}
        >
          <PricingPage />
        </WorkspacePage>
      );
      break;
    case "settings":
      content = <WorkspaceSettingsPage onNavigate={navigateToView} />;
      break;
    case "chat":
    default:
      content = <ChatArea />;
      break;
  }

  return (
    <div className="relative flex min-w-0 flex-1">
      {content}
      {primaryAgent && onboardingState && !onboardingState.dismissed && (
        <WorkspaceOnboarding
          lobsterName={primaryAgent.name}
          steps={onboardingState.steps}
          onNavigate={navigateOnboarding}
          onSkip={() => dismissOnboarding(primaryAgent.id)}
        />
      )}
    </div>
  );
}
