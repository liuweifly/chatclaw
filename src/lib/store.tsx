"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/components/auth-provider";
import {
  clearStorageScope,
  getAgentsByCompany,
  getAllCompanies,
  getStorageScope,
  getTeamsByCompany,
} from "@/lib/db";
import { GatewayClient } from "@/lib/gateway";
import type { LobsterWorkspaceChatResponse } from "@/lib/lobster-workspace";
import type { WorkspaceMetadataResponse } from "@/lib/workspace-metadata";
import { clearAllOnboardingState } from "@/lib/workspace";
import type {
  Agent,
  AgentIdentity,
  AgentSpecialty,
  AgentTeam,
  AppState,
  ChatEventPayload,
  ChatTarget,
  ChatTargetType,
  Company,
  ConnectionStatus,
  Message,
  WorkspaceView,
} from "@/types";

function dmSessionKey(agentId: string): string {
  return `agent:${agentId}:chatclaw:dm`;
}

function teamSessionKey(agentId: string, teamId: string): string {
  return `agent:${agentId}:chatclaw:team:${teamId}`;
}

type WorkspaceSnapshot = Pick<AppState, "companies" | "agents" | "teams">;

type Action =
  | { type: "RESET_STATE" }
  | { type: "SET_INITIALIZED" }
  | { type: "SET_COMPANIES"; companies: Company[] }
  | { type: "ADD_COMPANY"; company: Company }
  | { type: "UPDATE_COMPANY"; id: string; updates: Partial<Company> }
  | { type: "REMOVE_COMPANY"; id: string }
  | { type: "SET_AGENTS"; agents: Agent[] }
  | { type: "ADD_AGENT"; agent: Agent }
  | { type: "UPDATE_AGENT"; id: string; updates: Partial<Agent> }
  | { type: "REMOVE_AGENT"; id: string }
  | { type: "SET_TEAMS"; teams: AgentTeam[] }
  | { type: "ADD_TEAM"; team: AgentTeam }
  | { type: "UPDATE_TEAM"; id: string; updates: Partial<AgentTeam> }
  | { type: "REMOVE_TEAM"; id: string }
  | { type: "SET_ACTIVE_COMPANY"; id: string | null }
  | { type: "SET_ACTIVE_VIEW"; view: WorkspaceView }
  | { type: "SET_CHAT_TARGET"; target: ChatTarget | null }
  | { type: "SET_MESSAGES"; messages: Message[] }
  | { type: "ADD_MESSAGE"; message: Message }
  | { type: "SET_CONNECTION_STATUS"; status: ConnectionStatus }
  | { type: "SET_AGENT_IDENTITY"; agentId: string; identity: AgentIdentity }
  | {
      type: "SET_STREAMING";
      agentId: string;
      targetType: ChatTargetType;
      targetId: string;
      sessionKey: string;
      isStreaming: boolean;
    }
  | {
      type: "SET_STREAMING_CONTENT";
      agentId: string;
      content: string;
      runId: string | null;
    }
  | { type: "CLEAR_STREAMING"; agentId: string };

const initialState: AppState = {
  companies: [],
  agents: [],
  teams: [],
  messages: [],
  activeCompanyId: null,
  activeChatTarget: null,
  activeView: "chat",
  connectionStatus: "disconnected",
  agentIdentities: {},
  streamingStates: {},
  initialized: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "RESET_STATE":
      return initialState;

    case "SET_INITIALIZED":
      return { ...state, initialized: true };

    case "SET_COMPANIES":
      return { ...state, companies: action.companies };
    case "ADD_COMPANY":
      return { ...state, companies: [...state.companies, action.company] };
    case "UPDATE_COMPANY":
      return {
        ...state,
        companies: state.companies.map((company) =>
          company.id === action.id ? { ...company, ...action.updates } : company
        ),
      };
    case "REMOVE_COMPANY": {
      const nextState = {
        ...state,
        companies: state.companies.filter((company) => company.id !== action.id),
        agents: state.agents.filter((agent) => agent.companyId !== action.id),
        teams: state.teams.filter((team) => team.companyId !== action.id),
      };
      if (state.activeCompanyId === action.id) {
        nextState.activeCompanyId = nextState.companies[0]?.id ?? null;
        nextState.activeChatTarget = null;
        nextState.messages = [];
      }
      return nextState;
    }

    case "SET_AGENTS":
      return { ...state, agents: action.agents };
    case "ADD_AGENT":
      return { ...state, agents: [...state.agents, action.agent] };
    case "UPDATE_AGENT":
      return {
        ...state,
        agents: state.agents.map((agent) =>
          agent.id === action.id ? { ...agent, ...action.updates } : agent
        ),
      };
    case "REMOVE_AGENT":
      return {
        ...state,
        agents: state.agents.filter((agent) => agent.id !== action.id),
      };

    case "SET_TEAMS":
      return { ...state, teams: action.teams };
    case "ADD_TEAM":
      return { ...state, teams: [...state.teams, action.team] };
    case "UPDATE_TEAM":
      return {
        ...state,
        teams: state.teams.map((team) =>
          team.id === action.id ? { ...team, ...action.updates } : team
        ),
      };
    case "REMOVE_TEAM":
      return { ...state, teams: state.teams.filter((team) => team.id !== action.id) };

    case "SET_ACTIVE_COMPANY":
      return { ...state, activeCompanyId: action.id, activeChatTarget: null, messages: [] };
    case "SET_ACTIVE_VIEW":
      return { ...state, activeView: action.view };
    case "SET_CHAT_TARGET":
      return { ...state, activeChatTarget: action.target };
    case "SET_MESSAGES":
      return { ...state, messages: action.messages };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };

    case "SET_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.status };
    case "SET_AGENT_IDENTITY":
      return {
        ...state,
        agentIdentities: { ...state.agentIdentities, [action.agentId]: action.identity },
      };

    case "SET_STREAMING":
      if (action.isStreaming) {
        return {
          ...state,
          streamingStates: {
            ...state.streamingStates,
            [action.agentId]: {
              isStreaming: true,
              content: "",
              runId: null,
              targetType: action.targetType,
              targetId: action.targetId,
              sessionKey: action.sessionKey,
            },
          },
        };
      }
      return {
        ...state,
        streamingStates: Object.fromEntries(
          Object.entries(state.streamingStates).filter(([key]) => key !== action.agentId)
        ),
      };
    case "SET_STREAMING_CONTENT":
      return {
        ...state,
        streamingStates: {
          ...state.streamingStates,
          [action.agentId]: {
            ...state.streamingStates[action.agentId],
            content: action.content,
            runId: action.runId,
          },
        },
      };
    case "CLEAR_STREAMING":
      return {
        ...state,
        streamingStates: Object.fromEntries(
          Object.entries(state.streamingStates).filter(([key]) => key !== action.agentId)
        ),
      };

    default:
      return state;
  }
}

function resolvePreferredChatTarget(
  snapshot: WorkspaceSnapshot,
  companyId: string,
  preferredTarget: ChatTarget | null | undefined
) {
  if (preferredTarget) {
    if (
      preferredTarget.type === "agent" &&
      snapshot.agents.some(
        (agent) => agent.companyId === companyId && agent.id === preferredTarget.id
      )
    ) {
      return preferredTarget;
    }

    if (
      preferredTarget.type === "team" &&
      snapshot.teams.some(
        (team) => team.companyId === companyId && team.id === preferredTarget.id
      )
    ) {
      return preferredTarget;
    }
  }

  const company = snapshot.companies.find((entry) => entry.id === companyId);
  if (!company?.defaultAgentId) {
    return null;
  }

  const hasDefaultAgent = snapshot.agents.some(
    (agent) => agent.companyId === companyId && agent.id === company.defaultAgentId
  );
  if (!hasDefaultAgent) {
    return null;
  }

  return {
    type: "agent" as const,
    id: company.defaultAgentId,
  };
}

interface StoreActions {
  createCompany: (name: string, description?: string) => Promise<Company>;
  updateCompany: (id: string, updates: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  selectCompany: (id: string) => Promise<void>;

  createAgent: (opts: {
    companyId: string;
    name: string;
    description: string;
    specialty: AgentSpecialty;
  }) => Promise<Agent>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;

  createTeam: (opts: {
    companyId: string;
    name: string;
    description?: string;
    agentIds: string[];
  }) => Promise<AgentTeam>;
  updateTeam: (id: string, updates: Partial<AgentTeam>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;

  selectChatTarget: (target: ChatTarget) => Promise<void>;
  setActiveView: (view: WorkspaceView) => void;
  sendMessage: (content: string) => Promise<void>;
  abortStreaming: (agentId: string) => Promise<void>;

  connectGateway: () => void;
  disconnectGateway: () => void;
  restartGateway: () => Promise<void>;
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  actions: StoreActions;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const gatewayRef = useRef<GatewayClient | null>(null);
  const pendingStreamResolvers = useRef<Map<string, () => void>>(new Map());
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const loadWorkspaceMessages = useCallback(
    async (companyId: string, target: ChatTarget, teamsOverride?: AgentTeam[]) => {
      try {
        const params = new URLSearchParams({
          targetType: target.type,
          targetId: target.id,
        });

        if (target.type === "team") {
          const teams = teamsOverride ?? stateRef.current.teams;
          const team = teams.find((entry) => entry.id === target.id);
          if (!team) {
            return [] as Message[];
          }
          if (team.agentIds.length > 0) {
            params.set("agentIds", team.agentIds.join(","));
          }
        }

        const response = await fetch(`/api/lobsters/${companyId}/chat?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Could not load workspace chat history");
        }

        const payload = (await response.json()) as LobsterWorkspaceChatResponse;
        return Array.isArray(payload.history?.messages) ? payload.history.messages : [];
      } catch {
        return [] as Message[];
      }
    },
    []
  );

  const fetchWorkspaceMetadata = useCallback(async () => {
    const response = await fetch("/api/workspaces", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not load workspaces");
    }
    return (await response.json()) as WorkspaceMetadataResponse;
  }, []);

  const migrateLegacyLocalMetadata = useCallback(
    async (userId: string, remoteSnapshot: WorkspaceMetadataResponse) => {
      const scope = getStorageScope(userId);
      const localCompanies = await getAllCompanies(scope);
      if (localCompanies.length === 0) {
        return false;
      }

      let changed = false;
      const remoteCompanyIds = new Set(remoteSnapshot.companies.map((company) => company.id));
      const remoteAgentIds = new Set(remoteSnapshot.agents.map((agent) => agent.id));
      const remoteTeamIds = new Set(remoteSnapshot.teams.map((team) => team.id));
      const remoteCompaniesById = new Map(
        remoteSnapshot.companies.map((company) => [company.id, company])
      );

      for (const company of localCompanies) {
        if (!remoteCompanyIds.has(company.id)) {
          const createResponse = await fetch("/api/workspaces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: company.id,
              name: company.name,
              description: company.description,
            }),
          });
          if (!createResponse.ok) {
            throw new Error(`Could not migrate workspace ${company.id}`);
          }
          remoteCompanyIds.add(company.id);
          remoteCompaniesById.set(company.id, company);
          changed = true;
        }

        const localAgents = await getAgentsByCompany(scope, company.id);
        for (const agent of localAgents) {
          if (remoteAgentIds.has(agent.id)) {
            continue;
          }

          const createResponse = await fetch(`/api/workspaces/${company.id}/agents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: agent.id,
              name: agent.name,
              description: agent.description,
              specialty: agent.specialty,
            }),
          });
          if (!createResponse.ok) {
            throw new Error(`Could not migrate agent ${agent.id}`);
          }
          remoteAgentIds.add(agent.id);
          changed = true;
        }

        const localTeams = await getTeamsByCompany(scope, company.id);
        for (const team of localTeams) {
          if (remoteTeamIds.has(team.id)) {
            continue;
          }

          if (!team.agentIds.every((agentId) => remoteAgentIds.has(agentId))) {
            throw new Error(`Could not migrate team ${team.id}: missing members`);
          }

          const createResponse = await fetch(`/api/workspaces/${company.id}/teams`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: team.id,
              name: team.name,
              description: team.description,
              agentIds: team.agentIds,
            }),
          });
          if (!createResponse.ok) {
            throw new Error(`Could not migrate team ${team.id}`);
          }
          remoteTeamIds.add(team.id);
          changed = true;
        }

        const remoteCompany = remoteCompaniesById.get(company.id);
        if (
          remoteCompany?.name !== company.name ||
          remoteCompany?.description !== company.description ||
          remoteCompany?.defaultAgentId !== company.defaultAgentId
        ) {
          const updateResponse = await fetch(`/api/workspaces/${company.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: company.name,
              description: company.description,
              defaultAgentId: company.defaultAgentId ?? null,
            }),
          });
          if (!updateResponse.ok) {
            throw new Error(`Could not finalize workspace migration for ${company.id}`);
          }
          changed = true;
        }
      }

      await clearStorageScope(scope);
      return changed || localCompanies.length > 0;
    },
    []
  );

  const hydrateWorkspaceState = useCallback(
    async (
      snapshot: WorkspaceMetadataResponse,
      options?: {
        preferredCompanyId?: string | null;
        preferredTarget?: ChatTarget | null;
      }
    ) => {
      const nextCompanyId =
        options?.preferredCompanyId &&
        snapshot.companies.some((company) => company.id === options.preferredCompanyId)
          ? options.preferredCompanyId
          : snapshot.companies[0]?.id ?? null;

      dispatch({ type: "SET_COMPANIES", companies: snapshot.companies });
      dispatch({ type: "SET_AGENTS", agents: snapshot.agents });
      dispatch({ type: "SET_TEAMS", teams: snapshot.teams });
      dispatch({ type: "SET_ACTIVE_COMPANY", id: nextCompanyId });

      if (!nextCompanyId) {
        dispatch({ type: "SET_CHAT_TARGET", target: null });
        dispatch({ type: "SET_MESSAGES", messages: [] });
        return;
      }

      const nextTarget = resolvePreferredChatTarget(
        snapshot,
        nextCompanyId,
        options?.preferredTarget
      );
      dispatch({ type: "SET_CHAT_TARGET", target: nextTarget });

      if (!nextTarget) {
        dispatch({ type: "SET_MESSAGES", messages: [] });
        return;
      }

      const messages = await loadWorkspaceMessages(
        nextCompanyId,
        nextTarget,
        snapshot.teams
      );
      dispatch({ type: "SET_MESSAGES", messages });
    },
    [loadWorkspaceMessages]
  );

  const refreshWorkspaceState = useCallback(
    async (options?: {
      preferredCompanyId?: string | null;
      preferredTarget?: ChatTarget | null;
    }) => {
      const snapshot = await fetchWorkspaceMetadata();
      await hydrateWorkspaceState(snapshot, options);
      return snapshot;
    },
    [fetchWorkspaceMetadata, hydrateWorkspaceState]
  );

  const resolveAgentFromSession = useCallback((sessionKey: string): string | null => {
    const match = sessionKey.match(/^agent:([^:]+):/);
    return match ? match[1] : null;
  }, []);

  const connectGateway = useCallback(() => {
    const current = stateRef.current;
    if (!current.activeCompanyId) {
      return;
    }

    if (gatewayRef.current) {
      gatewayRef.current.destroy();
    }

    const client = new GatewayClient();
    gatewayRef.current = client;

    client.configure({
      onConnectionStatus: (status: ConnectionStatus) => {
        dispatch({ type: "SET_CONNECTION_STATUS", status });
      },
      onChatEvent: (payload: ChatEventPayload) => {
        const agentId = resolveAgentFromSession(payload.sessionKey);
        if (!agentId) {
          return;
        }

        const currentState = stateRef.current;
        const streaming = currentState.streamingStates[agentId];
        const text = payload.message?.content?.[0]?.text ?? "";

        switch (payload.state) {
          case "delta": {
            dispatch({
              type: "SET_STREAMING_CONTENT",
              agentId,
              content: text,
              runId: payload.runId,
            });
            break;
          }

          case "final": {
            const finalText = text || streaming?.content || "";
            if (finalText && streaming) {
              const message: Message = {
                id: uuidv4(),
                targetType: streaming.targetType,
                targetId: streaming.targetId,
                role: "assistant",
                agentId,
                content: finalText,
                createdAt: payload.message?.timestamp ?? Date.now(),
              };
              const activeState = stateRef.current;
              if (
                activeState.activeChatTarget?.type === streaming.targetType &&
                activeState.activeChatTarget?.id === streaming.targetId
              ) {
                dispatch({ type: "ADD_MESSAGE", message });
              }
            }
            dispatch({
              type: "SET_STREAMING",
              agentId,
              targetType: streaming?.targetType ?? "agent",
              targetId: streaming?.targetId ?? "",
              sessionKey: "",
              isStreaming: false,
            });
            const finalResolver = pendingStreamResolvers.current.get(agentId);
            if (finalResolver) {
              pendingStreamResolvers.current.delete(agentId);
              finalResolver();
            }
            break;
          }

          case "error": {
            const errorText = payload.error || text || "An error occurred";
            if (streaming) {
              const message: Message = {
                id: uuidv4(),
                targetType: streaming.targetType,
                targetId: streaming.targetId,
                role: "assistant",
                agentId,
                content: `Error: ${errorText}`,
                createdAt: Date.now(),
              };
              const activeState = stateRef.current;
              if (
                activeState.activeChatTarget?.type === streaming.targetType &&
                activeState.activeChatTarget?.id === streaming.targetId
              ) {
                dispatch({ type: "ADD_MESSAGE", message });
              }
            }
            dispatch({
              type: "SET_STREAMING",
              agentId,
              targetType: streaming?.targetType ?? "agent",
              targetId: streaming?.targetId ?? "",
              sessionKey: "",
              isStreaming: false,
            });
            const errorResolver = pendingStreamResolvers.current.get(agentId);
            if (errorResolver) {
              pendingStreamResolvers.current.delete(agentId);
              errorResolver();
            }
            break;
          }

          case "aborted": {
            const abortedText = streaming?.content;
            if (abortedText && streaming) {
              const message: Message = {
                id: uuidv4(),
                targetType: streaming.targetType,
                targetId: streaming.targetId,
                role: "assistant",
                agentId,
                content: abortedText,
                createdAt: Date.now(),
              };
              const activeState = stateRef.current;
              if (
                activeState.activeChatTarget?.type === streaming.targetType &&
                activeState.activeChatTarget?.id === streaming.targetId
              ) {
                dispatch({ type: "ADD_MESSAGE", message });
              }
            }
            dispatch({
              type: "SET_STREAMING",
              agentId,
              targetType: streaming?.targetType ?? "agent",
              targetId: streaming?.targetId ?? "",
              sessionKey: "",
              isStreaming: false,
            });
            const abortedResolver = pendingStreamResolvers.current.get(agentId);
            if (abortedResolver) {
              pendingStreamResolvers.current.delete(agentId);
              abortedResolver();
            }
            break;
          }
        }
      },
      onError: () => {},
    });

    void client.connect();
  }, [resolveAgentFromSession]);

  const disconnectGateway = useCallback(() => {
    if (gatewayRef.current) {
      gatewayRef.current.destroy();
      gatewayRef.current = null;
    }
    dispatch({ type: "SET_CONNECTION_STATUS", status: "disconnected" });
  }, []);

  const resetLocalState = useCallback(() => {
    pendingStreamResolvers.current.clear();
    disconnectGateway();
    dispatch({ type: "RESET_STATE" });
  }, [disconnectGateway]);

  const createCompanyAction = useCallback(
    async (name: string, description?: string) => {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not create workspace");
      }

      const payload = (await response.json()) as { company: Company };
      await refreshWorkspaceState({
        preferredCompanyId: payload.company.id,
        preferredTarget: null,
      });
      return payload.company;
    },
    [refreshWorkspaceState]
  );

  const updateCompanyAction = useCallback(
    async (id: string, updates: Partial<Company>) => {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
          defaultAgentId:
            Object.prototype.hasOwnProperty.call(updates, "defaultAgentId")
              ? updates.defaultAgentId ?? null
              : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not update workspace");
      }

      const current = stateRef.current;
      await refreshWorkspaceState({
        preferredCompanyId: current.activeCompanyId ?? id,
        preferredTarget: current.activeChatTarget,
      });
    },
    [refreshWorkspaceState]
  );

  const deleteCompanyAction = useCallback(
    async (id: string) => {
      const current = stateRef.current;
      if (current.activeCompanyId === id) {
        disconnectGateway();
      }

      const response = await fetch(`/api/workspaces/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Could not delete workspace");
      }

      const preferredCompanyId =
        current.activeCompanyId === id
          ? current.companies.find((company) => company.id !== id)?.id ?? null
          : current.activeCompanyId;

      await refreshWorkspaceState({
        preferredCompanyId,
        preferredTarget:
          current.activeCompanyId === id ? null : current.activeChatTarget,
      });
    },
    [disconnectGateway, refreshWorkspaceState]
  );

  const selectCompanyAction = useCallback(
    async (id: string) => {
      const current = stateRef.current;
      const company = current.companies.find((entry) => entry.id === id);

      disconnectGateway();
      dispatch({ type: "SET_ACTIVE_COMPANY", id });

      const nextTarget = company
        ? resolvePreferredChatTarget(current, id, null)
        : null;
      dispatch({ type: "SET_CHAT_TARGET", target: nextTarget });

      if (!nextTarget) {
        dispatch({ type: "SET_MESSAGES", messages: [] });
      } else {
        const messages = await loadWorkspaceMessages(id, nextTarget, current.teams);
        dispatch({ type: "SET_MESSAGES", messages });
      }

      setTimeout(() => connectGateway(), 50);
    },
    [connectGateway, disconnectGateway, loadWorkspaceMessages]
  );

  const createAgentAction = useCallback(
    async (opts: {
      companyId: string;
      name: string;
      description: string;
      specialty: AgentSpecialty;
    }) => {
      const response = await fetch(`/api/workspaces/${opts.companyId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });

      if (!response.ok) {
        throw new Error("Could not create agent");
      }

      const payload = (await response.json()) as { agent: Agent };
      const current = stateRef.current;
      await refreshWorkspaceState({
        preferredCompanyId: current.activeCompanyId ?? opts.companyId,
        preferredTarget: current.activeChatTarget,
      });
      return payload.agent;
    },
    [refreshWorkspaceState]
  );

  const updateAgentAction = useCallback(
    async (id: string, updates: Partial<Agent>) => {
      const current = stateRef.current;
      const agent = current.agents.find((entry) => entry.id === id);
      if (!agent) {
        return;
      }

      const response = await fetch(`/api/workspaces/${agent.companyId}/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
          specialty: updates.specialty,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not update agent");
      }

      await refreshWorkspaceState({
        preferredCompanyId: current.activeCompanyId ?? agent.companyId,
        preferredTarget: current.activeChatTarget,
      });
    },
    [refreshWorkspaceState]
  );

  const deleteAgentAction = useCallback(
    async (id: string) => {
      const current = stateRef.current;
      const deletedAgent = current.agents.find((agent) => agent.id === id);
      if (!deletedAgent) {
        return;
      }

      const response = await fetch(
        `/api/workspaces/${deletedAgent.companyId}/agents/${id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error("Could not delete agent");
      }

      const preferredTarget =
        current.activeChatTarget?.type === "agent" && current.activeChatTarget.id === id
          ? null
          : current.activeChatTarget;

      await refreshWorkspaceState({
        preferredCompanyId: current.activeCompanyId ?? deletedAgent.companyId,
        preferredTarget,
      });
    },
    [refreshWorkspaceState]
  );

  const createTeamAction = useCallback(
    async (opts: {
      companyId: string;
      name: string;
      description?: string;
      agentIds: string[];
    }) => {
      const response = await fetch(`/api/workspaces/${opts.companyId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });

      if (!response.ok) {
        throw new Error("Could not create team");
      }

      const payload = (await response.json()) as { team: AgentTeam };
      const current = stateRef.current;
      await refreshWorkspaceState({
        preferredCompanyId: current.activeCompanyId ?? opts.companyId,
        preferredTarget: current.activeChatTarget,
      });
      return payload.team;
    },
    [refreshWorkspaceState]
  );

  const updateTeamAction = useCallback(
    async (id: string, updates: Partial<AgentTeam>) => {
      const current = stateRef.current;
      const team = current.teams.find((entry) => entry.id === id);
      if (!team) {
        return;
      }

      const response = await fetch(`/api/workspaces/${team.companyId}/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
          agentIds: updates.agentIds,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not update team");
      }

      await refreshWorkspaceState({
        preferredCompanyId: current.activeCompanyId ?? team.companyId,
        preferredTarget: current.activeChatTarget,
      });
    },
    [refreshWorkspaceState]
  );

  const deleteTeamAction = useCallback(
    async (id: string) => {
      const current = stateRef.current;
      const team = current.teams.find((entry) => entry.id === id);
      if (!team) {
        return;
      }

      const response = await fetch(`/api/workspaces/${team.companyId}/teams/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Could not delete team");
      }

      const preferredTarget =
        current.activeChatTarget?.type === "team" && current.activeChatTarget.id === id
          ? null
          : current.activeChatTarget;

      await refreshWorkspaceState({
        preferredCompanyId: current.activeCompanyId ?? team.companyId,
        preferredTarget,
      });
    },
    [refreshWorkspaceState]
  );

  const selectChatTargetAction = useCallback(
    async (target: ChatTarget) => {
      const current = stateRef.current;
      dispatch({ type: "SET_ACTIVE_VIEW", view: "chat" });
      dispatch({ type: "SET_CHAT_TARGET", target });

      if (!current.activeCompanyId) {
        dispatch({ type: "SET_MESSAGES", messages: [] });
        return;
      }

      const messages = await loadWorkspaceMessages(
        current.activeCompanyId,
        target,
        current.teams
      );
      dispatch({ type: "SET_MESSAGES", messages });
    },
    [loadWorkspaceMessages]
  );

  const setActiveViewAction = useCallback((view: WorkspaceView) => {
    dispatch({ type: "SET_ACTIVE_VIEW", view });
  }, []);

  const sendMessageAction = useCallback(async (content: string) => {
    const current = stateRef.current;
    const target = current.activeChatTarget;
    if (!target) {
      return;
    }

    const client = gatewayRef.current;
    if (!client || !client.isConnected()) {
      return;
    }

    const userMessage: Message = {
      id: uuidv4(),
      targetType: target.type,
      targetId: target.id,
      role: "user",
      content,
      createdAt: Date.now(),
    };
    dispatch({ type: "ADD_MESSAGE", message: userMessage });

    if (target.type === "agent") {
      const sessionKey = dmSessionKey(target.id);
      dispatch({
        type: "SET_STREAMING",
        agentId: target.id,
        targetType: "agent",
        targetId: target.id,
        sessionKey,
        isStreaming: true,
      });
      try {
        await client.sendMessage(sessionKey, content);
      } catch {
        dispatch({
          type: "SET_STREAMING",
          agentId: target.id,
          targetType: "agent",
          targetId: target.id,
          sessionKey,
          isStreaming: false,
        });
      }
      return;
    }

    const team = current.teams.find((entry) => entry.id === target.id);
    if (!team) {
      return;
    }

    const streamTimeout = 5 * 60 * 1000;
    const teamHistory = current.messages
      .filter((message) => message.targetType === "team" && message.targetId === target.id)
      .map((message) => {
        if (message.role === "user") {
          return `[User]: ${message.content}`;
        }
        const agent = current.agents.find((entry) => entry.id === message.agentId);
        return `[${agent?.name || message.agentId || "Assistant"}]: ${message.content}`;
      })
      .join("\n\n");

    const currentRoundReplies: Array<{ agentName: string; content: string }> = [];

    for (const agentId of team.agentIds) {
      const sessionKey = teamSessionKey(agentId, target.id);
      dispatch({
        type: "SET_STREAMING",
        agentId,
        targetType: "team",
        targetId: target.id,
        sessionKey,
        isStreaming: true,
      });

      try {
        let messageToSend = content;
        const contextParts: string[] = [];

        if (teamHistory) {
          contextParts.push(`[Team conversation history]\n${teamHistory}`);
        }

        if (currentRoundReplies.length > 0) {
          const roundContext = currentRoundReplies
            .map((reply) => `[${reply.agentName}]: ${reply.content}`)
            .join("\n\n");
          contextParts.push(`[Current round replies]\n${roundContext}`);
        }

        if (contextParts.length > 0) {
          messageToSend = `${contextParts.join("\n\n")}\n\n[New user message]\n${content}`;
        }

        await client.sendMessage(sessionKey, messageToSend);

        await Promise.race([
          new Promise<void>((resolve) => {
            pendingStreamResolvers.current.set(agentId, resolve);
          }),
          new Promise<void>((resolve) =>
            setTimeout(() => {
              pendingStreamResolvers.current.delete(agentId);
              resolve();
            }, streamTimeout)
          ),
        ]);

        const latestState = stateRef.current;
        const agentReply = [...latestState.messages].reverse().find(
          (message) =>
            message.role === "assistant" &&
            message.agentId === agentId &&
            message.targetId === target.id
        );
        if (agentReply) {
          const agent = latestState.agents.find((entry) => entry.id === agentId);
          currentRoundReplies.push({
            agentName: agent?.name || agentId,
            content: agentReply.content,
          });
        }
      } catch {
        dispatch({
          type: "SET_STREAMING",
          agentId,
          targetType: "team",
          targetId: target.id,
          sessionKey,
          isStreaming: false,
        });
      }
    }
  }, []);

  const abortStreamingAction = useCallback(async (agentId: string) => {
    const current = stateRef.current;
    const streaming = current.streamingStates[agentId];
    if (!streaming) {
      return;
    }

    const client = gatewayRef.current;
    if (!client) {
      return;
    }

    try {
      await client.abortChat(streaming.sessionKey, streaming.runId ?? undefined);
    } catch {
      dispatch({ type: "CLEAR_STREAMING", agentId });
    }
  }, []);

  const restartGatewayAction = useCallback(async () => {
    try {
      await fetch("/api/gateway/restart", { method: "POST" });
      disconnectGateway();
      setTimeout(() => connectGateway(), 2000);
    } catch {
      // Failed to restart.
    }
  }, [connectGateway, disconnectGateway]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      resetLocalState();

      const currentUserId = user?.id ?? null;
      const previousUserId = previousUserIdRef.current;
      previousUserIdRef.current = currentUserId;

      if (previousUserId !== undefined && previousUserId !== currentUserId) {
        clearAllOnboardingState();
      }

      if (!currentUserId) {
        dispatch({ type: "SET_INITIALIZED" });
        return;
      }

      try {
        let snapshot = await fetchWorkspaceMetadata();
        if (cancelled) {
          return;
        }

        const migrated = await migrateLegacyLocalMetadata(currentUserId, snapshot);
        if (cancelled) {
          return;
        }

        if (migrated) {
          snapshot = await fetchWorkspaceMetadata();
          if (cancelled) {
            return;
          }
        }

        await hydrateWorkspaceState(snapshot, {
          preferredCompanyId: null,
          preferredTarget: null,
        });
      } catch {
        if (!cancelled) {
          dispatch({ type: "SET_COMPANIES", companies: [] });
          dispatch({ type: "SET_AGENTS", agents: [] });
          dispatch({ type: "SET_TEAMS", teams: [] });
          dispatch({ type: "SET_ACTIVE_COMPANY", id: null });
          dispatch({ type: "SET_CHAT_TARGET", target: null });
          dispatch({ type: "SET_MESSAGES", messages: [] });
        }
      }

      if (!cancelled) {
        dispatch({ type: "SET_INITIALIZED" });
      }
    }

    void init();

    return () => {
      if (gatewayRef.current) {
        gatewayRef.current.destroy();
        gatewayRef.current = null;
      }
      cancelled = true;
    };
  }, [
    fetchWorkspaceMetadata,
    hydrateWorkspaceState,
    migrateLegacyLocalMetadata,
    resetLocalState,
    user?.id,
  ]);

  useEffect(() => {
    if (state.initialized && state.activeCompanyId) {
      connectGateway();
    }
  }, [connectGateway, state.activeCompanyId, state.initialized]);

  const actions: StoreActions = {
    createCompany: createCompanyAction,
    updateCompany: updateCompanyAction,
    deleteCompany: deleteCompanyAction,
    selectCompany: selectCompanyAction,
    createAgent: createAgentAction,
    updateAgent: updateAgentAction,
    deleteAgent: deleteAgentAction,
    createTeam: createTeamAction,
    updateTeam: updateTeamAction,
    deleteTeam: deleteTeamAction,
    selectChatTarget: selectChatTargetAction,
    setActiveView: setActiveViewAction,
    sendMessage: sendMessageAction,
    abortStreaming: abortStreamingAction,
    connectGateway,
    disconnectGateway,
    restartGateway: restartGatewayAction,
  };

  return (
    <StoreContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return context;
}
