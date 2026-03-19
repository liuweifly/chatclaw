"use client";

import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Brain,
  Clock,
  Globe,
  Plug,
  Shield,
  Wrench,
  Zap,
} from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/components/auth-provider";
import { PricingPage } from "@/components/pricing-page";
import { useLocale, useTranslations } from "@/i18n/provider";

const FEATURE_ICONS = [Plug, Brain, Wrench, Clock, Bot, Shield] as const;

export function LandingPage({
  onEnter,
  isAuthenticated,
}: {
  onEnter: () => void;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("landing");
  const authT = useTranslations("auth");
  const locale = useLocale();
  const { updateProfileLocale } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#1a1b1e] text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦞</span>
          <span className="font-bold text-lg">ChatClaw</span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1"
            role="group"
            aria-label={t("nav.language")}
          >
            {[
              { value: "en", label: "EN" },
              { value: "zh", label: "中文" },
            ].map((option) => {
              const active = locale === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void updateProfileLocale(option.value)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[#5865f2] text-white shadow-lg shadow-[#5865f2]/20"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {!isAuthenticated && (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              {authT("signInCta")}
            </button>
          )}
          {isAuthenticated && (
            <button
              type="button"
              onClick={onEnter}
              className="rounded-full bg-[#5865f2] px-5 py-2 text-sm font-semibold transition-colors hover:bg-[#4752c4]"
            >
              {t("hero.goToWorkspace")}
            </button>
          )}
        </div>
      </nav>
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />

      <section className="relative overflow-hidden px-6 pb-28 pt-20 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,101,242,0.25),transparent_50%)]" />
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/70">
            <Zap className="h-3.5 w-3.5" />
            {t("hero.badge")}
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            {t("hero.titlePrefix")}{" "}
            <span className="bg-gradient-to-r from-[#5865f2] to-[#23a55a] bg-clip-text text-transparent">
              {t("hero.titleAccent")}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl">
            {t("hero.description")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={onEnter}
              className="flex items-center gap-2 rounded-full bg-[#5865f2] px-8 py-3.5 text-base font-semibold transition-colors hover:bg-[#4752c4] shadow-lg shadow-[#5865f2]/25"
            >
              {isAuthenticated ? t("hero.goToWorkspace") : t("hero.create")}
              <ArrowRight className="h-4 w-4" />
            </button>
            <span className="text-sm text-white/40">{t("hero.subline")}</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold">{t("comparison.title")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/50">{t("comparison.description")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="mx-auto w-full max-w-2xl text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 pr-4 text-left font-medium text-white/50">
                  {t("comparison.table.feature")}
                </th>
                <th className="px-4 py-3 text-center font-medium">
                  <span className="text-lg">🦞</span> {t("comparison.table.us")}
                </th>
                <th className="py-3 pl-4 text-center font-medium text-white/50">
                  {t("comparison.table.them")}
                </th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5, 6].map((index) => {
                const ours = index !== 6;
                const theirs = index === 6;
                return (
                  <tr key={index} className="border-b border-white/5">
                    <td className="py-3 pr-4 text-white/70">
                      {t(`comparison.rows.${index}.label`)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={ours ? "font-bold text-[#23a55a]" : "text-white/20"}>
                        {ours ? "✓" : "—"}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-center">
                      <span className={theirs ? "text-white/40" : "text-white/20"}>
                        {theirs ? "✓" : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold">{t("features.title")}</h2>
          <p className="mt-3 text-white/50">{t("features.description")}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_ICONS.map((Icon, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 transition-colors hover:border-white/15"
            >
              <Icon className="mb-4 h-8 w-8 text-[#5865f2]" />
              <h3 className="mb-2 font-semibold text-base">
                {t(`features.items.${index}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-white/50">
                {t(`features.items.${index}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold">{t("steps.title")}</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#5865f2]/20 text-lg font-bold text-[#5865f2]">
                {index + 1}
              </div>
              <h3 className="mb-2 font-semibold">{t(`steps.items.${index}.title`)}</h3>
              <p className="text-sm text-white/50">{t(`steps.items.${index}.description`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <PricingPage embedded onRequireAuth={onEnter} />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-8 text-center">
          <Globe className="mx-auto h-8 w-8 text-[#23a55a]" />
          <h2 className="mt-4 text-2xl font-semibold">{t("cta.title")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/50">
            {t("cta.description")}
          </p>
          <button
            onClick={onEnter}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#5865f2] px-8 py-3.5 text-base font-semibold transition-colors hover:bg-[#4752c4] shadow-lg shadow-[#5865f2]/25"
          >
            {isAuthenticated ? t("hero.goToWorkspace") : t("cta.button")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-sm text-white/30">
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="text-lg">🦞</span>
          <span className="font-semibold text-white/50">ChatClaw</span>
        </div>
        <p>{t("footer")}</p>
      </footer>
    </div>
  );
}
