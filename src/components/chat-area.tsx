"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Bot,
  Loader2,
  Send,
  Sparkles,
  Square,
  Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { cn } from "@/lib/utils";
import { createAgent as dbCreateAgent } from "@/lib/db";
import {
  getAgentRoleLabel,
  initializeOnboardingState,
} from "@/lib/workspace";
import type { Agent } from "@/types";

function StreamingDots() {
  return (
    <span className="inline-flex gap-1 ml-1">
      <span className="streaming-dot-1 inline-block h-1.5 w-1.5 rounded-full bg-discord-muted" />
      <span className="streaming-dot-2 inline-block h-1.5 w-1.5 rounded-full bg-discord-muted" />
      <span className="streaming-dot-3 inline-block h-1.5 w-1.5 rounded-full bg-discord-muted" />
    </span>
  );
}

const onboardingTemplates: Array<{
  value: Agent["specialty"];
  label: string;
  description: string;
}> = [
  {
    value: "general",
    label: "General",
    description: "Planning, analysis, and everyday operator work.",
  },
  {
    value: "research",
    label: "Research",
    description: "Synthesis, investigation, and decision support.",
  },
  {
    value: "coding",
    label: "Builder",
    description: "Prototypes, fixes, and technical execution.",
  },
  {
    value: "writing",
    label: "Writer",
    description: "Messaging, drafts, and crisp copy.",
  },
  {
    value: "design",
    label: "Design",
    description: "UX feedback, flows, and interface thinking.",
  },
];

function buildLobsterDescription(name: string, specialty: Agent["specialty"]) {
  const descriptions: Record<Agent["specialty"], string> = {
    general: `${name} is your personal lobster for planning, analysis, and moving work forward fast.`,
    research: `${name} is your personal lobster for research, synthesis, and pressure-testing decisions.`,
    coding: `${name} is your personal lobster for building prototypes, solving technical problems, and shipping fixes.`,
    writing: `${name} is your personal lobster for crisp messaging, drafts, and structured writing work.`,
    design: `${name} is your personal lobster for UX feedback, product flows, and interface direction.`,
  };

  return descriptions[specialty];
}

export function ChatArea() {
  const { state, dispatch, actions } = useStore();
  const [input, setInput] = useState("");
  const [composing, setComposing] = useState(false);
  const [lobsterName, setLobsterName] = useState("");
  const [lobsterRole, setLobsterRole] = useState<Agent["specialty"] | null>(null);
  const [creatingLobster, setCreatingLobster] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const target = state.activeChatTarget;
  const isConnected = state.connectionStatus === "connected";
  const activeCompany = state.companies.find((company) => company.id === state.activeCompanyId);
  const companyAgents = state.activeCompanyId
    ? state.agents.filter((agent) => agent.companyId === state.activeCompanyId)
    : [];

  // Get chat target info
  const targetAgent = target?.type === "agent"
    ? state.agents.find((a) => a.id === target.id)
    : null;
  const targetTeam = target?.type === "team"
    ? state.teams.find((t) => t.id === target.id)
    : null;
  const teamAgents = targetTeam
    ? state.agents.filter((a) => targetTeam.agentIds.includes(a.id))
    : [];

  // Streaming entries for current chat target
  const streamingEntries = Object.entries(state.streamingStates).filter(
    ([, s]) => target && s.targetType === target.type && s.targetId === target.id && s.isStreaming
  );
  const isStreamingCurrentTarget = streamingEntries.length > 0;
  const demoPrompts = target?.type === "team"
    ? [
        {
          label: "🗓️ Run my day",
          prompt: "Act as my executive operator. I have three meetings, two hours for deep work, and need to move a product demo forward. Build me a realistic schedule with clear priorities and time blocks.",
        },
        {
          label: "🔍 Stress-test my idea",
          prompt: "I want to build an AI operator that handles customer onboarding end-to-end. As a team, pressure-test this: what are the real strengths, hidden risks, and the one experiment I should run first?",
        },
        {
          label: "🚀 Ship my demo",
          prompt: "Work as a product team. I'm building a hosted OpenClaw demo. Tell me exactly what the landing page should promise, what the onboarding must do, and what would make a buyer say yes in five minutes.",
        },
      ]
    : [
        {
          label: "🔍 Research a topic",
          prompt: "Search the web for the latest news about AI agents and summarize the top 3 developments",
        },
        {
          label: "📄 Analyze a document",
          prompt: "I have a business plan I need feedback on. What questions should I answer before sharing it?",
        },
        {
          label: "🧠 Remember this",
          prompt: "Remember that my name is [user], I work on [project], and I prefer concise answers. Confirm what youve noted.",
        },
      ];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, streamingEntries]);

  // Auto-focus
  useEffect(() => {
    textareaRef.current?.focus();
  }, [target]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !target) return;
    setInput("");
    actions.sendMessage(text);
  }, [input, target, actions]);

  const handleDemoPrompt = useCallback(async (prompt: string) => {
    if (!target) return;
    if (isConnected && !isStreamingCurrentTarget) {
      setInput("");
      await actions.sendMessage(prompt);
      return;
    }

    setInput(prompt);
    textareaRef.current?.focus();
  }, [actions, isConnected, isStreamingCurrentTarget, target]);

  const handleCreateLobster = useCallback(async () => {
    if (creatingLobster) return;

    const trimmedName = lobsterName.trim();
    if (!trimmedName) {
      setCreationError("Name your lobster to continue.");
      return;
    }

    setCreatingLobster(true);
    setCreationError(null);

    try {
      let companyId = state.activeCompanyId;
      let bootstrapData:
        | {
            found?: boolean;
            gateway?: { url?: string; token?: string };
            agents?: Array<{ id: string; name: string }>;
          }
        | null = null;

      const importGatewayAgents = async (
        nextCompanyId: string,
        gatewayAgents: Array<{ id: string; name: string }>
      ) => {
        const importedAgents: Agent[] = [];

        for (const gatewayAgent of gatewayAgents) {
          const importedAgent: Agent = {
            id: gatewayAgent.id,
            companyId: nextCompanyId,
            name: gatewayAgent.name,
            description: `Demo-ready OpenClaw operator: ${gatewayAgent.name}`,
            specialty: "general",
            createdAt: Date.now(),
          };

          await dbCreateAgent(importedAgent);
          dispatch({ type: "ADD_AGENT", agent: importedAgent });
          importedAgents.push(importedAgent);
        }

        return importedAgents;
      };

      if (!companyId) {
        const response = await fetch("/api/bootstrap", { cache: "no-store" });
        if (response.ok) {
          bootstrapData = await response.json();
        }
      }

      if (!companyId) {
        const gatewayUrl = bootstrapData?.found ? bootstrapData.gateway?.url ?? "" : "";
        const gatewayToken = bootstrapData?.found ? bootstrapData.gateway?.token ?? "" : "";
        const company = await actions.createCompany(
          `${trimmedName} Workspace`,
          gatewayUrl,
          gatewayToken,
          gatewayUrl
            ? `Personal demo workspace for ${trimmedName}.`
            : `Personal workspace for ${trimmedName}. Connect a gateway to start chatting.`
        );

        companyId = company.id;
        await actions.selectCompany(company.id);

        if (Array.isArray(bootstrapData?.agents) && bootstrapData.agents.length > 0) {
          await importGatewayAgents(companyId, bootstrapData.agents);
        }
      }

      if (!companyId) {
        throw new Error("No workspace was available.");
      }

      const specialty = lobsterRole ?? "general";
      const nextAgent = await actions.createAgent({
        companyId,
        name: trimmedName,
        description: buildLobsterDescription(trimmedName, specialty),
        specialty,
      });

      await actions.updateCompany(companyId, { defaultAgentId: nextAgent.id });
      initializeOnboardingState(nextAgent.id);
      await actions.selectChatTarget({ type: "agent", id: nextAgent.id });
      setLobsterName("");
      setLobsterRole(null);
    } catch (error) {
      setCreationError(
        error instanceof Error ? error.message : "Could not create your lobster."
      );
    } finally {
      setCreatingLobster(false);
    }
  }, [actions, creatingLobster, dispatch, lobsterName, lobsterRole, state.activeCompanyId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !composing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, composing]
  );

  if (!state.initialized) {
    return (
      <div className="flex flex-1 h-full items-center justify-center bg-discord-light text-sm text-discord-muted">
        Loading workspace...
      </div>
    );
  }

  // No target selected — empty state
  if (!target) {
    const secondaryLine = activeCompany
      ? "Name it once, pick an optional role, and land directly in its chat."
      : "We’ll create the workspace, set a default lobster, and drop you straight into chat.";

    return (
      <div className="relative flex flex-1 h-full items-center justify-center overflow-hidden bg-discord-light px-6 py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,101,242,0.22),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(35,165,90,0.12),transparent_32%)]" />
        <div className="relative w-full max-w-3xl rounded-[28px] border border-white/6 bg-[#2a2d32]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                <Sparkles className="h-3.5 w-3.5 text-discord-green" />
                Personal workspace
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                Create your lobster in one short step.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-discord-muted">
                {secondaryLine}
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-discord-muted">
                <div className="rounded-full border border-white/8 bg-black/10 px-3 py-1.5">
                  1-click setup
                </div>
                <div className="rounded-full border border-white/8 bg-black/10 px-3 py-1.5">
                  Personal default chat
                </div>
                <div className="rounded-full border border-white/8 bg-black/10 px-3 py-1.5">
                  Guided setup
                </div>
              </div>
            </div>
            <div className="w-full max-w-sm rounded-3xl border border-white/8 bg-black/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                Start here
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Give it a name. Add a role if you want. Everything else stays available in the workspace.
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                    Name
                  </label>
                  <input
                    value={lobsterName}
                    onChange={(event) => {
                      setLobsterName(event.target.value);
                      if (creationError) {
                        setCreationError(null);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleCreateLobster();
                      }
                    }}
                    placeholder="Atlas"
                    className="mt-2 w-full rounded-2xl border border-white/8 bg-[#1f2126] px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-discord-muted focus:border-discord-blurple"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                      Role
                    </label>
                    <span className="text-[11px] text-discord-muted">Optional</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {onboardingTemplates.map((template) => {
                      const isActive = lobsterRole === template.value;
                      return (
                        <button
                          key={template.value}
                          onClick={() => setLobsterRole(isActive ? null : template.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs transition-colors",
                            isActive
                              ? "border-discord-blurple bg-discord-blurple text-white"
                              : "border-white/8 bg-[#1f2126] text-discord-muted hover:text-foreground"
                          )}
                          title={template.description}
                        >
                          {template.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <button
                onClick={() => void handleCreateLobster()}
                disabled={creatingLobster || !lobsterName.trim()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-discord-blurple px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-discord-blurple/85 disabled:cursor-wait disabled:opacity-70"
              >
                {creatingLobster && <Loader2 className="h-4 w-4 animate-spin" />}
                Create my lobster
              </button>
              {creationError && (
                <p className="mt-3 text-sm text-discord-red">{creationError}</p>
              )}
              {companyAgents.length > 0 && (
                <p className="mt-3 text-xs leading-5 text-discord-muted">
                  Demo agents stay available from the sidebar toggle when you need them.
                </p>
              )}
            </div>
          </div>
          <div className="mt-8 grid gap-3 rounded-3xl border border-white/6 bg-black/10 p-4 text-sm text-discord-muted md:grid-cols-3">
            <div>
              <p className="font-medium text-foreground">🗓️ Run my day</p>
              <p className="mt-1">Get an operator-grade schedule in one prompt.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">🔍 Stress-test my idea</p>
              <p className="mt-1">Pressure-test a concept with strengths, risks, and next steps.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">🚀 Ship my demo</p>
              <p className="mt-1">Turn a vague plan into a concrete product story.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chatTitle = target.type === "agent"
    ? (state.agentIdentities[target.id]?.name || targetAgent?.name || "Agent")
    : (targetTeam?.name || "Team");

  const chatSubtitle = target.type === "agent"
    ? getAgentRoleLabel(targetAgent?.specialty)
    : `${teamAgents.length} agent${teamAgents.length !== 1 ? "s" : ""}`;

  const placeholder = !isConnected
    ? "Gateway not connected..."
    : target.type === "agent"
    ? `Message ${chatTitle}`
    : `Message ${chatTitle} team`;
  return (
    <div className="flex flex-1 h-full flex-col bg-discord-light">
      {/* Chat header */}
      <div className="flex h-12 items-center gap-2 px-4 shadow-[0_1px_0_0_rgba(0,0,0,0.2)] shrink-0">
        {target.type === "agent" ? (
          <Bot className="h-5 w-5 text-discord-muted" />
        ) : (
          <Users className="h-5 w-5 text-discord-muted" />
        )}
        <span className="font-semibold text-[15px] text-foreground">{chatTitle}</span>
        {chatSubtitle && (
          <>
            <div className="mx-2 h-6 w-px bg-border" />
            <span className="text-sm text-discord-muted truncate">{chatSubtitle}</span>
          </>
        )}
        {target.type === "team" && teamAgents.length > 0 && (
          <div className="ml-auto flex -space-x-2">
            {teamAgents.slice(0, 5).map((agent) => {
              const identity = state.agentIdentities[agent.id];
              return (
                <div
                  key={agent.id}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-discord-light bg-discord-blurple text-white text-[10px] font-bold"
                  title={identity?.name || agent.name}
                >
                  {identity?.emoji || agent.name[0].toUpperCase()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {state.messages.length === 0 && streamingEntries.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-discord-muted">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-discord-mid">
              {target.type === "agent" ? (
                <Bot className="h-8 w-8" />
              ) : (
                <Users className="h-8 w-8" />
              )}
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">
              {target.type === "agent" ? `Hey! I'm ${chatTitle}` : `${chatTitle}`}
            </p>
            <p className="text-sm max-w-xl text-center leading-6">
              {target.type === "agent"
                ? `Hey! I'm ${chatTitle}, your ${getAgentRoleLabel(targetAgent?.specialty)} lobster. I can browse the web, analyze documents, and remember everything we discuss.`
                : targetTeam?.description || "Your specialist team is standing by."}
            </p>
            <p className="mt-4 text-xs text-discord-muted">
              Pick a task below or type anything to get started.
            </p>
            <div className="mt-4 flex w-full max-w-2xl flex-wrap justify-center gap-3">
              {demoPrompts.map((demoPrompt) => (
                <button
                  key={demoPrompt.label}
                  onClick={() => handleDemoPrompt(demoPrompt.prompt)}
                  className="min-w-[180px] rounded-2xl border border-white/8 bg-discord-mid px-4 py-3 text-left transition-colors hover:bg-[#373941]"
                >
                  <p className="text-sm font-medium text-foreground">{demoPrompt.label}</p>
                  <p className="mt-1 text-xs leading-5 text-discord-muted line-clamp-2">
                    {demoPrompt.prompt.slice(0, 80)}…
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.messages.map((msg) => {
          const agent = msg.agentId
            ? state.agents.find((a) => a.id === msg.agentId)
            : null;
          const identity = msg.agentId
            ? state.agentIdentities[msg.agentId]
            : null;
          const isUser = msg.role === "user";
          const time = new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={msg.id}
              className="group flex gap-4 py-0.5 hover:bg-black/[0.03] -mx-4 px-4 rounded"
            >
              <div className="shrink-0 mt-0.5">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
                    isUser
                      ? "bg-discord-green text-white"
                      : "bg-discord-blurple text-white"
                  )}
                >
                  {isUser
                    ? "U"
                    : identity?.emoji || agent?.name?.[0]?.toUpperCase() || "A"}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-semibold text-[15px]",
                      isUser ? "text-discord-green" : "text-discord-blurple"
                    )}
                  >
                    {isUser ? "You" : identity?.name || agent?.name || "Agent"}
                  </span>
                  <span className="text-[11px] text-discord-muted">{time}</span>
                </div>
                <div className="text-[15px] leading-relaxed text-foreground">
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming messages */}
        {streamingEntries.map(([agentId, streaming]) => {
          const agent = state.agents.find((a) => a.id === agentId);
          const identity = state.agentIdentities[agentId];

          return (
            <div key={agentId} className="flex gap-4 py-0.5 -mx-4 px-4">
              <div className="shrink-0 mt-0.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-discord-blurple text-white text-sm font-semibold">
                  {identity?.emoji || agent?.name?.[0]?.toUpperCase() || "A"}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-[15px] text-discord-blurple">
                    {identity?.name || agent?.name || "Agent"}
                  </span>
                  <StreamingDots />
                </div>
                <div className="text-[15px] leading-relaxed text-foreground">
                  {streaming.content ? (
                    <MarkdownRenderer content={streaming.content} />
                  ) : (
                    <span className="text-discord-muted italic">Thinking...</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
      {/* Input area */}
      <div className="shrink-0 px-4 pb-6 pt-0">
        <div className="flex items-end gap-2 rounded-lg bg-[#383a40] px-4 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            placeholder={placeholder}
            disabled={!isConnected}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[15px] text-foreground placeholder:text-discord-muted outline-none disabled:opacity-50"
            style={{ maxHeight: 200, minHeight: 24 }}
          />
          {streamingEntries.length > 0 ? (
            <button
              onClick={() => {
                for (const [agentId] of streamingEntries) {
                  actions.abortStreaming(agentId);
                }
              }}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded bg-discord-red text-white hover:bg-discord-red/80 transition-colors"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !isConnected}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded bg-discord-blurple text-white hover:bg-discord-blurple/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
