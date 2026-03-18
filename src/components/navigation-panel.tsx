"use client";

import { useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  House,
  Link2,
  MessageSquare,
  Package,
  Plus,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { CreateAgentDialog } from "@/components/dialogs/create-agent-dialog";
import { CreateTeamDialog } from "@/components/dialogs/create-team-dialog";
import { AgentSettingsDialog } from "@/components/dialogs/agent-settings-dialog";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { getPrimaryAgent } from "@/lib/workspace";
import type { Agent, WorkspaceView } from "@/types";

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
  label: string;
  emoji: string;
  icon: typeof House;
}> = [
  { id: "overview", label: "Overview", emoji: "🏠", icon: House },
  { id: "chat", label: "Chat", emoji: "💬", icon: MessageSquare },
  { id: "channels", label: "Channels", emoji: "🔗", icon: Link2 },
  { id: "skills", label: "Skills", emoji: "📦", icon: Package },
  { id: "memory", label: "Memory", emoji: "🧠", icon: Brain },
  { id: "settings", label: "Settings", emoji: "⚙️", icon: Settings },
];

export function NavigationPanel() {
  const { state, actions } = useStore();
  const [showDemoItems, setShowDemoItems] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const activeCompany = state.companies.find((company) => company.id === state.activeCompanyId);
  const primaryAgent = getPrimaryAgent(state);
  const companyAgents = state.agents.filter((agent) => agent.companyId === state.activeCompanyId);
  const demoAgents = companyAgents.filter((agent) => agent.id !== primaryAgent?.id);
  const companyTeams = state.teams.filter((team) => team.companyId === state.activeCompanyId);
  const isConnected = state.connectionStatus === "connected";

  if (!activeCompany) {
    return (
      <div className="flex h-full w-64 flex-col items-center justify-center bg-discord-mid px-6 text-center text-sm text-discord-muted">
        Create your lobster from the main panel to start a personal workspace.
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
              {primaryAgent?.name || "Your lobster"}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-discord-muted">
              <span>{isConnected ? "Online" : "Offline"}</span>
              <span className="text-white/15">•</span>
              <span className="truncate">
                {primaryAgent ? "Personal workspace" : "Create your first lobster"}
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
                <span className="flex-1 text-left">{item.label}</span>
                <Icon className="h-4 w-4 opacity-60" />
              </button>
            );
          })}
        </div>

        {showDemoItems && (
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 px-1">
                <button
                  onClick={() => setTeamsOpen((open) => !open)}
                  className="flex min-w-0 flex-1 items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-discord-muted hover:text-sidebar-primary"
                >
                  {teamsOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  Demo Teams
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowCreateTeam(true);
                  }}
                  className="ml-auto text-discord-muted hover:text-sidebar-primary"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {teamsOpen && (
                <div className="mt-1 space-y-0.5">
                  {companyTeams.map((team) => {
                    const isActive =
                      state.activeChatTarget?.type === "team" &&
                      state.activeChatTarget.id === team.id &&
                      state.activeView === "chat";

                    return (
                      <div
                        key={team.id}
                        className={cn(
                          "group flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[15px]",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-discord-muted hover:bg-accent/50 hover:text-sidebar-primary"
                        )}
                      >
                        <button
                          onClick={() => void actions.selectChatTarget({ type: "team", id: team.id })}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        >
                          <Users className="h-4 w-4 shrink-0 opacity-60" />
                          <span className="truncate">{team.name}</span>
                          <span className="ml-auto text-[11px] text-discord-muted">
                            {team.agentIds.length}
                          </span>
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void actions.deleteTeam(team.id);
                          }}
                          className="text-discord-muted opacity-0 transition-opacity hover:text-discord-red group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {companyTeams.length === 0 && (
                    <p className="px-2 py-1 text-[12px] italic text-discord-muted">
                      No demo teams yet.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 px-1">
                <button
                  onClick={() => setAgentsOpen((open) => !open)}
                  className="flex min-w-0 flex-1 items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-discord-muted hover:text-sidebar-primary"
                >
                  {agentsOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  Demo Agents
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowCreateAgent(true);
                  }}
                  className="ml-auto text-discord-muted hover:text-sidebar-primary"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {agentsOpen && (
                <div className="mt-1 space-y-0.5">
                  {demoAgents.map((agent) => {
                    const identity = state.agentIdentities[agent.id];
                    const isActive =
                      state.activeChatTarget?.type === "agent" &&
                      state.activeChatTarget.id === agent.id &&
                      state.activeView === "chat";

                    return (
                      <div
                        key={agent.id}
                        className={cn(
                          "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[15px]",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-discord-muted hover:bg-accent/50"
                        )}
                      >
                        <button
                          onClick={() => void actions.selectChatTarget({ type: "agent", id: agent.id })}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <div className="relative shrink-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-blurple text-xs font-semibold text-white">
                              {identity?.emoji || agent.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5">
                              <ConnectionDot connected={isConnected} />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <div className="truncate text-sm text-sidebar-primary">
                              {identity?.name || agent.name}
                            </div>
                            <div className="truncate text-[11px] text-discord-muted">
                              {agent.specialty}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingAgent(agent);
                          }}
                          className="text-discord-muted opacity-0 transition-opacity hover:text-sidebar-primary group-hover:opacity-100"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {demoAgents.length === 0 && (
                    <p className="px-2 py-1 text-[12px] italic text-discord-muted">
                      No extra demo agents yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/6 p-3">
        <button
          onClick={() => setShowDemoItems((visible) => !visible)}
          className="flex w-full items-center justify-between rounded-xl border border-white/6 bg-black/10 px-3 py-2 text-xs font-medium text-discord-muted transition-colors hover:bg-white/[0.04] hover:text-sidebar-primary"
        >
          <span>{showDemoItems ? "Hide demo agents" : "Show demo agents"}</span>
          {showDemoItems ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <CreateAgentDialog open={showCreateAgent} onOpenChange={setShowCreateAgent} />
      <CreateTeamDialog open={showCreateTeam} onOpenChange={setShowCreateTeam} />
      {editingAgent && (
        <AgentSettingsDialog
          agent={editingAgent}
          open={!!editingAgent}
          onOpenChange={(open) => {
            if (!open) {
              setEditingAgent(null);
            }
          }}
        />
      )}
    </div>
  );
}
