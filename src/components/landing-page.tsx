"use client";

import {
  Bot,
  MessageSquare,
  Brain,
  Plug,
  Clock,
  Wrench,
  ArrowRight,
  Zap,
  Shield,
  Globe,
} from "lucide-react";

const FEATURES = [
  {
    icon: Plug,
    title: "Lives where you work",
    desc: "Connect to Telegram, Feishu, Discord, Slack — not just a web tab.",
  },
  {
    icon: Brain,
    title: "Remembers everything",
    desc: "Long-term memory across sessions. It knows your projects, preferences, and context.",
  },
  {
    icon: Wrench,
    title: "Actually does things",
    desc: "Browses the web, reads docs, sends messages, runs scripts, manages files.",
  },
  {
    icon: Clock,
    title: "Always online",
    desc: "Your lobster runs 24/7. Scheduled tasks, proactive alerts, background work.",
  },
  {
    icon: Bot,
    title: "Multi-agent teams",
    desc: "Spin up specialists — coder, researcher, writer — and let them collaborate.",
  },
  {
    icon: Shield,
    title: "Your data, your rules",
    desc: "Self-hosted runtime. No vendor lock-in. Full control over keys and config.",
  },
];

const COMPARE = [
  { feature: "Persistent memory", us: true, them: false },
  { feature: "Multi-channel (TG, Feishu, Discord)", us: true, them: false },
  { feature: "Always-on (24/7 background)", us: true, them: false },
  { feature: "Executes real tasks", us: true, them: false },
  { feature: "Multi-agent collaboration", us: true, them: false },
  { feature: "Self-hosted / full control", us: true, them: false },
  { feature: "Chat with AI", us: true, them: true },
];

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-screen bg-[#1a1b1e] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦞</span>
          <span className="font-bold text-lg">OpenClaw</span>
        </div>
        <button
          onClick={onEnter}
          className="rounded-full bg-[#5865f2] px-5 py-2 text-sm font-semibold hover:bg-[#4752c4] transition-colors"
        >
          Try the demo
        </button>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-20 pb-28 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,101,242,0.25),transparent_50%)]" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/70 mb-6">
            <Zap className="h-3.5 w-3.5" />
            Not another chatbot
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] tracking-tight">
            Your AI that{" "}
            <span className="bg-gradient-to-r from-[#5865f2] to-[#23a55a] bg-clip-text text-transparent">
              actually works
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            Create a lobster — an AI operator that lives in your Telegram, Feishu, or Discord.
            It remembers you, executes tasks, and runs 24/7. Not a chat window. A teammate.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onEnter}
              className="flex items-center gap-2 rounded-full bg-[#5865f2] px-8 py-3.5 text-base font-semibold hover:bg-[#4752c4] transition-colors shadow-lg shadow-[#5865f2]/25"
            >
              Create my lobster
              <ArrowRight className="h-4 w-4" />
            </button>
            <span className="text-sm text-white/40">Free demo · No signup required</span>
          </div>
        </div>
      </section>

      {/* Why not ChatGPT */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Why not just use ChatGPT?</h2>
          <p className="mt-3 text-white/50 max-w-xl mx-auto">
            ChatGPT is great for one-off questions. But it forgets you, can&apos;t reach your tools,
            and goes offline when you close the tab.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full max-w-2xl mx-auto text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 pr-4 text-white/50 font-medium">Feature</th>
                <th className="py-3 px-4 text-center font-medium">
                  <span className="text-lg">🦞</span> Lobster
                </th>
                <th className="py-3 pl-4 text-center font-medium text-white/50">ChatGPT</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.feature} className="border-b border-white/5">
                  <td className="py-3 pr-4 text-white/70">{row.feature}</td>
                  <td className="py-3 px-4 text-center">
                    {row.us ? (
                      <span className="text-[#23a55a] font-bold">✓</span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                  <td className="py-3 pl-4 text-center">
                    {row.them ? (
                      <span className="text-white/40">✓</span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">What your lobster can do</h2>
          <p className="mt-3 text-white/50">
            It&apos;s not a chatbot. It&apos;s an operator.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 hover:border-white/15 transition-colors"
            >
              <f.icon className="h-8 w-8 text-[#5865f2] mb-4" />
              <h3 className="font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">30 seconds to your first lobster</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Name it",
              desc: "Give your lobster a name and pick a role.",
            },
            {
              step: "2",
              title: "Chat with it",
              desc: "Start talking immediately. Try a preset task or ask anything.",
            },
            {
              step: "3",
              title: "Connect channels",
              desc: "Deploy to Telegram, Feishu, Discord — it goes where you work.",
            },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#5865f2]/20 text-[#5865f2] font-bold text-lg mb-4">
                {s.step}
              </div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-white/50">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <button
            onClick={onEnter}
            className="inline-flex items-center gap-2 rounded-full bg-[#5865f2] px-8 py-3.5 text-base font-semibold hover:bg-[#4752c4] transition-colors shadow-lg shadow-[#5865f2]/25"
          >
            Create my lobster now
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-sm text-white/30">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-lg">🦞</span>
          <span className="font-semibold text-white/50">OpenClaw</span>
        </div>
        <p>
          Powered by{" "}
          <a
            href="https://github.com/openclaw/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/50 hover:text-white/70 underline underline-offset-2"
          >
            OpenClaw
          </a>{" "}
          · Open source AI agent runtime
        </p>
      </footer>
    </div>
  );
}
