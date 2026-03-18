"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Bot, Brain, Link2, Package, Settings } from "lucide-react";
import { ChatArea } from "@/components/chat-area";
import {
  ChannelsPanel,
  MemoryPanel,
  SkillsPanel,
} from "@/components/lobster-dashboard";
import { LobsterOverview } from "@/components/lobster-overview";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";
import { useStore } from "@/lib/store";
import {
  dismissOnboarding,
  getPrimaryAgent,
  markOnboardingStep,
  readOnboardingState,
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

function SettingsPage() {
  return (
    <WorkspacePage
      title="Settings"
      description="Workspace-level configuration will live here."
      icon={Settings}
    >
      <div className="max-w-2xl rounded-xl border border-white/6 bg-discord-mid p-6">
        <h2 className="text-lg font-semibold text-foreground">Settings coming soon</h2>
        <p className="mt-2 text-sm leading-6 text-discord-muted">
          Gateway controls and deeper lobster configuration still exist in the current workspace,
          and this page will become the dedicated home for them.
        </p>
      </div>
    </WorkspacePage>
  );
}

export function WorkspaceMain() {
  const { state, actions } = useStore();
  const primaryAgent = getPrimaryAgent(state);
  const [onboardingState, setOnboardingState] = useState<LobsterOnboardingState | null>(null);

  useEffect(() => {
    if (!primaryAgent) {
      setOnboardingState(null);
      return;
    }

    setOnboardingState(readOnboardingState(primaryAgent.id));
  }, [primaryAgent]);

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

    setOnboardingState(markOnboardingStep(primaryAgent.id, onboardingView));
  }, [onboardingState, primaryAgent, state.activeView]);

  useEffect(() => {
    if (!primaryAgent || !onboardingState || onboardingState.dismissed) {
      return;
    }

    if (Object.values(onboardingState.steps).every(Boolean)) {
      setOnboardingState(dismissOnboarding(primaryAgent.id));
    }
  }, [onboardingState, primaryAgent]);

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
          title="Channels"
          description="Connect your lobster to the places where work already happens."
          icon={Link2}
        >
          <ChannelsPanel />
        </WorkspacePage>
      );
      break;
    case "skills":
      content = (
        <WorkspacePage
          title="Skills"
          description="Install focused abilities and integrations for your lobster."
          icon={Package}
        >
          <SkillsPanel />
        </WorkspacePage>
      );
      break;
    case "memory":
      content = (
        <WorkspacePage
          title="Memory"
          description="Review the long-term context your lobster keeps across conversations."
          icon={Brain}
        >
          <MemoryPanel />
        </WorkspacePage>
      );
      break;
    case "settings":
      content = <SettingsPage />;
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
          onSkip={() => setOnboardingState(dismissOnboarding(primaryAgent.id))}
        />
      )}
    </div>
  );
}
