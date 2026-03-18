"use client";

import { Bot, Brain, MessageSquare, Plug, Sparkles, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Tab = "channels" | "memory" | "capabilities" | "skills";

const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: "channels", label: "Channels", icon: Plug },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "capabilities", label: "Capabilities", icon: Wrench },
  { id: "skills", label: "Skills", icon: Sparkles },
];

const CHANNELS = [
  {
    name: "Web Chat",
    status: "connected" as const,
    desc: "Chat directly in the browser.",
    icon: "🌐",
  },
  {
    name: "Telegram",
    status: "available" as const,
    desc: "Deploy your lobster as a Telegram bot.",
    icon: "✈️",
  },
  {
    name: "Feishu",
    status: "available" as const,
    desc: "Connect to Feishu (Lark) for team messaging.",
    icon: "🐦",
  },
  {
    name: "Discord",
    status: "available" as const,
    desc: "Add your lobster to any Discord server.",
    icon: "🎮",
  },
  {
    name: "Slack",
    status: "coming_soon" as const,
    desc: "Slack integration coming soon.",
    icon: "💬",
  },
];

const MEMORY_ITEMS = [
  { key: "Long-term memory", value: "Persists across sessions. Your lobster remembers projects, preferences, and past decisions." },
  { key: "Daily notes", value: "Auto-logged daily context — what happened, what was discussed, what to follow up on." },
  { key: "User profile", value: "Knows your name, timezone, communication style, and working habits." },
  { key: "Project context", value: "Tracks active projects, goals, deadlines, and key decisions." },
];

const CAPABILITIES = [
  { name: "Web browsing", desc: "Search and read web pages in real time.", active: true },
  { name: "File management", desc: "Read, write, and organize files in the workspace.", active: true },
  { name: "Code execution", desc: "Run scripts, build projects, execute shell commands.", active: true },
  { name: "Send messages", desc: "Proactively send messages to connected channels.", active: true },
  { name: "Scheduled tasks", desc: "Cron jobs, reminders, periodic checks.", active: true },
  { name: "Image analysis", desc: "Analyze screenshots, photos, and diagrams.", active: true },
  { name: "PDF reading", desc: "Extract and analyze content from PDF documents.", active: true },
  { name: "Email access", desc: "Read and send emails via connected accounts.", active: false },
];

const SKILLS = [
  { name: "GitHub", desc: "Manage issues, PRs, and CI runs.", installed: true },
  { name: "Google Workspace", desc: "Gmail, Calendar, Drive, Docs, Sheets.", installed: true },
  { name: "Weather", desc: "Current weather and forecasts.", installed: true },
  { name: "Web Search", desc: "AI-optimized web search.", installed: true },
  { name: "Coding Agent", desc: "Delegate coding tasks to Codex / Claude Code.", installed: true },
  { name: "SEO Toolkit", desc: "Site audits, content writing, keyword research.", installed: false },
  { name: "Notion", desc: "Create and manage Notion pages and databases.", installed: false },
  { name: "Analytics", desc: "Google Analytics 4 and Search Console.", installed: false },
];

export function LobsterDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("channels");

  return (
    <div className="flex h-full flex-col bg-discord-light">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-white/5 px-3 py-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-discord-blurple text-white"
                  : "text-discord-muted hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "channels" && <ChannelsPanel />}
        {activeTab === "memory" && <MemoryPanel />}
        {activeTab === "capabilities" && <CapabilitiesPanel />}
        {activeTab === "skills" && <SkillsPanel />}
      </div>
    </div>
  );
}

function ChannelsPanel() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-discord-muted mb-4">
        Your lobster can live in multiple channels at once. Connect where you work.
      </p>
      {CHANNELS.map((ch) => (
        <div
          key={ch.name}
          className="flex items-center gap-3 rounded-xl border border-white/6 bg-discord-mid p-3"
        >
          <span className="text-xl">{ch.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{ch.name}</span>
              {ch.status === "connected" && (
                <span className="rounded-full bg-[#23a55a]/20 px-2 py-0.5 text-[10px] font-semibold text-[#23a55a]">
                  Connected
                </span>
              )}
              {ch.status === "available" && (
                <span className="rounded-full bg-discord-blurple/20 px-2 py-0.5 text-[10px] font-semibold text-discord-blurple">
                  Available
                </span>
              )}
              {ch.status === "coming_soon" && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-discord-muted">
                  Coming soon
                </span>
              )}
            </div>
            <p className="text-xs text-discord-muted mt-0.5">{ch.desc}</p>
          </div>
          {ch.status === "available" && (
            <button className="shrink-0 rounded-lg bg-discord-blurple px-3 py-1.5 text-xs font-semibold text-white hover:bg-discord-blurple/80 transition-colors">
              Connect
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function MemoryPanel() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-discord-muted mb-4">
        Your lobster builds memory over time. It remembers you, your projects, and your preferences.
      </p>
      {MEMORY_ITEMS.map((item) => (
        <div
          key={item.key}
          className="rounded-xl border border-white/6 bg-discord-mid p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-3.5 w-3.5 text-discord-blurple" />
            <span className="text-sm font-medium text-foreground">{item.key}</span>
          </div>
          <p className="text-xs text-discord-muted leading-5">{item.value}</p>
        </div>
      ))}
      <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/10 p-4 text-center">
        <p className="text-xs text-discord-muted">
          Memory grows as you chat. The more you use your lobster, the better it knows you.
        </p>
      </div>
    </div>
  );
}

function CapabilitiesPanel() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-discord-muted mb-4">
        These are the things your lobster can actually do — not just talk about.
      </p>
      {CAPABILITIES.map((cap) => (
        <div
          key={cap.name}
          className="flex items-center gap-3 rounded-xl border border-white/6 bg-discord-mid p-3"
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              cap.active ? "bg-[#23a55a]/20" : "bg-white/5"
            )}
          >
            <Wrench
              className={cn(
                "h-4 w-4",
                cap.active ? "text-[#23a55a]" : "text-discord-muted"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{cap.name}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  cap.active
                    ? "bg-[#23a55a]/20 text-[#23a55a]"
                    : "bg-white/10 text-discord-muted"
                )}
              >
                {cap.active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-xs text-discord-muted mt-0.5">{cap.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillsPanel() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-discord-muted mb-4">
        Skills are plug-in modules that give your lobster specialized abilities.
      </p>
      {SKILLS.map((skill) => (
        <div
          key={skill.name}
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
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{skill.name}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  skill.installed
                    ? "bg-discord-blurple/20 text-discord-blurple"
                    : "bg-white/10 text-discord-muted"
                )}
              >
                {skill.installed ? "Installed" : "Available"}
              </span>
            </div>
            <p className="text-xs text-discord-muted mt-0.5">{skill.desc}</p>
          </div>
          {!skill.installed && (
            <button className="shrink-0 rounded-lg bg-discord-blurple px-3 py-1.5 text-xs font-semibold text-white hover:bg-discord-blurple/80 transition-colors">
              Install
            </button>
          )}
        </div>
      ))}
      <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/10 p-4 text-center">
        <p className="text-xs text-discord-muted">
          Browse more skills at{" "}
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
