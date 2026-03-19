"use client";

import type { Agent, AgentSpecialty, AppState } from "@/types";

export type OnboardingStepView = "chat" | "channels" | "skills";

export interface LobsterOnboardingState {
  dismissed: boolean;
  steps: Record<OnboardingStepView, boolean>;
}

const defaultOnboardingState: LobsterOnboardingState = {
  dismissed: false,
  steps: {
    chat: false,
    channels: false,
    skills: false,
  },
};

const onboardingListeners = new Set<() => void>();

function onboardingStorageKey(agentId: string) {
  return `chatclaw:onboarding:${agentId}`;
}

function emitOnboardingChange() {
  for (const listener of onboardingListeners) {
    listener();
  }
}

export function subscribeOnboarding(listener: () => void) {
  onboardingListeners.add(listener);
  return () => {
    onboardingListeners.delete(listener);
  };
}

export function getPrimaryAgent(state: Pick<AppState, "companies" | "agents" | "activeCompanyId">): Agent | null {
  const activeCompany = state.companies.find((company) => company.id === state.activeCompanyId);
  if (!activeCompany?.defaultAgentId) {
    return null;
  }

  return (
    state.agents.find(
      (agent) =>
        agent.companyId === activeCompany.id && agent.id === activeCompany.defaultAgentId
    ) ?? null
  );
}

export function getAgentRoleLabel(specialty?: AgentSpecialty | null) {
  switch (specialty) {
    case "coding":
      return "builder";
    case "research":
      return "research";
    case "writing":
      return "writer";
    case "design":
      return "design";
    default:
      return "general-purpose";
  }
}

export function readOnboardingState(agentId: string): LobsterOnboardingState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(onboardingStorageKey(agentId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LobsterOnboardingState>;
    return {
      dismissed: Boolean(parsed.dismissed),
      steps: {
        chat: Boolean(parsed.steps?.chat),
        channels: Boolean(parsed.steps?.channels),
        skills: Boolean(parsed.steps?.skills),
      },
    };
  } catch {
    return null;
  }
}

export function initializeOnboardingState(agentId: string) {
  if (typeof window === "undefined") {
    return defaultOnboardingState;
  }

  window.localStorage.setItem(
    onboardingStorageKey(agentId),
    JSON.stringify(defaultOnboardingState)
  );
  emitOnboardingChange();

  return defaultOnboardingState;
}

export function writeOnboardingState(agentId: string, state: LobsterOnboardingState) {
  if (typeof window === "undefined") {
    return state;
  }

  window.localStorage.setItem(onboardingStorageKey(agentId), JSON.stringify(state));
  emitOnboardingChange();
  return state;
}

export function markOnboardingStep(agentId: string, step: OnboardingStepView) {
  const current = readOnboardingState(agentId) ?? defaultOnboardingState;
  return writeOnboardingState(agentId, {
    ...current,
    steps: {
      ...current.steps,
      [step]: true,
    },
  });
}

export function dismissOnboarding(agentId: string) {
  const current = readOnboardingState(agentId) ?? defaultOnboardingState;
  return writeOnboardingState(agentId, {
    ...current,
    dismissed: true,
  });
}
