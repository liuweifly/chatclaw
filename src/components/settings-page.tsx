"use client";

import { useState } from "react";
import { Globe2, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "@/i18n/provider";
import { pickUserAvatar, pickUserName } from "@/lib/supabase/shared";
import type { WorkspaceView } from "@/types";

export function SettingsPage({
  onNavigate,
}: {
  onNavigate: (view: WorkspaceView) => void;
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const {
    user,
    profile,
    subscription,
    signOut,
    updateProfileLocale,
    deleteAccount,
  } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const avatar = pickUserAvatar(user, profile);
  const name = pickUserName(user, profile);
  const plan = subscription?.plan ?? "free";

  async function handleDeleteAccount() {
    const confirmed = window.confirm(t("danger.confirm"));
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteAccount();
      window.location.href = "/";
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-discord-light">
      <div className="border-b border-white/6 px-6 py-5">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-discord-muted">{t("description")}</p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <section className="rounded-2xl border border-white/6 bg-discord-mid p-6">
          <div className="flex items-center gap-4">
            <Avatar data-size="lg" className="size-14">
              <AvatarImage src={avatar ?? undefined} alt={name} />
              <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-foreground">{name}</h2>
              <p className="truncate text-sm text-discord-muted">{user?.email || "—"}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/6 bg-discord-mid p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("plan.title")}</h2>
              <p className="mt-1 text-sm text-discord-muted">{t(`plan.${plan}`)}</p>
            </div>
            {plan === "free" ? (
              <Button
                type="button"
                onClick={() => onNavigate("pricing")}
                className="bg-discord-blurple text-white hover:bg-discord-blurple/85"
              >
                {t("plan.upgrade")}
              </Button>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/6 bg-discord-mid p-6">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-discord-blurple" />
            <h2 className="text-lg font-semibold text-foreground">{t("language.title")}</h2>
          </div>
          <p className="mt-1 text-sm text-discord-muted">{t("language.description")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { value: "en", label: "English" },
              { value: "zh", label: "中文" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => void updateProfileLocale(option.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  locale === option.value
                    ? "border-discord-blurple bg-discord-blurple/20 text-foreground"
                    : "border-white/8 bg-discord-dark text-discord-muted hover:text-foreground"
                }`}
              >
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/6 bg-discord-mid p-6">
          <h2 className="text-lg font-semibold text-foreground">{t("session.title")}</h2>
          <p className="mt-1 text-sm text-discord-muted">{t("session.description")}</p>
          <Button
            type="button"
            onClick={() => void signOut()}
            variant="secondary"
            className="mt-4 bg-discord-dark text-foreground hover:bg-discord-darker"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("session.logout")}
          </Button>
        </section>

        <section className="rounded-2xl border border-discord-red/30 bg-discord-mid p-6">
          <h2 className="text-lg font-semibold text-foreground">{t("danger.title")}</h2>
          <p className="mt-1 text-sm text-discord-muted">{t("danger.description")}</p>
          <Button
            type="button"
            onClick={() => void handleDeleteAccount()}
            disabled={deleting}
            variant="destructive"
            className="mt-4 bg-discord-red text-white hover:bg-discord-red/85"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("danger.delete")}
          </Button>
        </section>
      </div>
    </div>
  );
}
