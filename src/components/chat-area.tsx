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
import { useAuth } from "@/components/auth-provider";
import { useStore } from "@/lib/store";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { cn } from "@/lib/utils";
import { createAgent as dbCreateAgent, getStorageScope } from "@/lib/db";
import {
  getAgentRoleKey,
  initializeOnboardingState,
} from "@/lib/workspace";
import { useLocale, useTranslations } from "@/i18n/provider";
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
  const t = useTranslations("workspace.chat");
  const workspaceT = useTranslations("workspace");
  const locale = useLocale();
  const { user } = useAuth();
  const { state, dispatch, actions } = useStore();
  const storageScope = getStorageScope(user?.id ?? null);
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
          label: t("prompts.team.0.label"),
          prompt: t("prompts.team.0.prompt"),
        },
        {
          label: t("prompts.team.1.label"),
          prompt: t("prompts.team.1.prompt"),
        },
        {
          label: t("prompts.team.2.label"),
          prompt: t("prompts.team.2.prompt"),
        },
      ]
    : [
        {
          label: t("prompts.agent.0.label"),
          prompt: t("prompts.agent.0.prompt"),
        },
        {
          label: t("prompts.agent.1.label"),
          prompt: t("prompts.agent.1.prompt"),
        },
        {
          label: t("prompts.agent.2.label"),
          prompt: t("prompts.agent.2.prompt"),
        },
      ];
  const onboardingTemplates: Array<{
    value: Agent["specialty"];
    label: string;
    description: string;
  }> = [
    {
      value: "general",
      label: t("roles.general.label"),
      description: t("roles.general.description"),
    },
    {
      value: "research",
      label: t("roles.research.label"),
      description: t("roles.research.description"),
    },
    {
      value: "coding",
      label: t("roles.coding.label"),
      description: t("roles.coding.description"),
    },
    {
      value: "writing",
      label: t("roles.writing.label"),
      description: t("roles.writing.description"),
    },
    {
      value: "design",
      label: t("roles.design.label"),
      description: t("roles.design.description"),
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
      setCreationError(t("errors.nameRequired"));
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

          await dbCreateAgent(storageScope, importedAgent);
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
            : t("errors.gatewayHint", { name: trimmedName })
        );

        companyId = company.id;
        await actions.selectCompany(company.id);

        if (Array.isArray(bootstrapData?.agents) && bootstrapData.agents.length > 0) {
          await importGatewayAgents(companyId, bootstrapData.agents);
        }
      }

      if (!companyId) {
        throw new Error(t("errors.noWorkspace"));
      }

      const specialty = lobsterRole ?? "general";
      const nextAgent = await actions.createAgent({
        companyId,
        name: trimmedName,
        description: buildLobsterDescription(trimmedName, specialty),
        specialty,
      });

      if (user) {
        await fetch("/api/lobsters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: companyId,
            name: trimmedName,
            role: specialty,
            agentId: nextAgent.id,
            status: "active",
          }),
        }).catch(() => null);
      }

      await actions.updateCompany(companyId, { defaultAgentId: nextAgent.id });
      initializeOnboardingState(nextAgent.id);
      await actions.selectChatTarget({ type: "agent", id: nextAgent.id });
      setLobsterName("");
      setLobsterRole(null);
    } catch (error) {
      setCreationError(
        error instanceof Error ? error.message : t("errors.createFailed")
      );
    } finally {
      setCreatingLobster(false);
    }
  }, [actions, creatingLobster, dispatch, lobsterName, lobsterRole, state.activeCompanyId, storageScope, t, user]);

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
        {t("loading")}
      </div>
    );
  }

  // No target selected — empty state
  if (!target) {
    const secondaryLine = activeCompany
      ? t("empty.secondaryExisting")
      : t("empty.secondaryNew");

    return (
      <div className="relative flex flex-1 h-full items-center justify-center overflow-hidden bg-discord-light px-6 py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,101,242,0.22),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(35,165,90,0.12),transparent_32%)]" />
        <div className="relative w-full max-w-3xl rounded-[28px] border border-white/6 bg-[#2a2d32]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                <Sparkles className="h-3.5 w-3.5 text-discord-green" />
                {t("empty.badge")}
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                {t("empty.title")}
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-discord-muted">
                {secondaryLine}
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-discord-muted">
                <div className="rounded-full border border-white/8 bg-black/10 px-3 py-1.5">
                  {t("empty.tags.setup")}
                </div>
                <div className="rounded-full border border-white/8 bg-black/10 px-3 py-1.5">
                  {t("empty.tags.defaultChat")}
                </div>
                <div className="rounded-full border border-white/8 bg-black/10 px-3 py-1.5">
                  {t("empty.tags.guided")}
                </div>
              </div>
            </div>
            <div className="w-full max-w-sm rounded-3xl border border-white/8 bg-black/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                {t("empty.cardTitle")}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {t("empty.cardDescription")}
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                    {t("empty.form.name")}
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
                    placeholder={t("empty.form.namePlaceholder")}
                    className="mt-2 w-full rounded-2xl border border-white/8 bg-[#1f2126] px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-discord-muted focus:border-discord-blurple"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                      {t("empty.form.role")}
                    </label>
                    <span className="text-[11px] text-discord-muted">{t("empty.form.optional")}</span>
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
                {t("empty.form.submit")}
              </button>
              {creationError && (
                <p className="mt-3 text-sm text-discord-red">{creationError}</p>
              )}
              {companyAgents.length > 0 && (
                <p className="mt-3 text-xs leading-5 text-discord-muted">
                  {t("empty.form.sidebarHint")}
                </p>
              )}
            </div>
          </div>
          <div className="mt-8 grid gap-3 rounded-3xl border border-white/6 bg-black/10 p-4 text-sm text-discord-muted md:grid-cols-3">
            <div>
              <p className="font-medium text-foreground">{t("examples.0.title")}</p>
              <p className="mt-1">{t("examples.0.description")}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">{t("examples.1.title")}</p>
              <p className="mt-1">{t("examples.1.description")}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">{t("examples.2.title")}</p>
              <p className="mt-1">{t("examples.2.description")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chatTitle = target.type === "agent"
    ? (state.agentIdentities[target.id]?.name || targetAgent?.name || t("agentFallback"))
    : (targetTeam?.name || t("teamFallback"));

  const chatSubtitle = target.type === "agent"
    ? workspaceT(`roles.${getAgentRoleKey(targetAgent?.specialty)}`)
    : teamAgents.length === 1
    ? t("teamAgents.one", { count: teamAgents.length })
    : t("teamAgents.other", { count: teamAgents.length });

  const placeholder = !isConnected
    ? t("gatewayUnavailable")
    : target.type === "agent"
    ? t("placeholder.agent", { name: chatTitle })
    : t("placeholder.team", { name: chatTitle });
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
              {target.type === "agent" ? t("intro.agentTitle", { name: chatTitle }) : chatTitle}
            </p>
            <p className="text-sm max-w-xl text-center leading-6">
              {target.type === "agent"
                ? t("intro.agentBody", {
                    name: chatTitle,
                    role: workspaceT(`roles.${getAgentRoleKey(targetAgent?.specialty)}`),
                  })
                : targetTeam?.description || t("intro.teamBody")}
            </p>
            <p className="mt-4 text-xs text-discord-muted">
              {t("intro.pickPrompt")}
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
          const time = new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(msg.createdAt));

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
                    {isUser ? t("you") : identity?.name || agent?.name || t("agentFallback")}
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
                    {identity?.name || agent?.name || t("agentFallback")}
                  </span>
                  <StreamingDots />
                </div>
                <div className="text-[15px] leading-relaxed text-foreground">
                  {streaming.content ? (
                    <MarkdownRenderer content={streaming.content} />
                  ) : (
                    <span className="text-discord-muted italic">{t("thinking")}</span>
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
