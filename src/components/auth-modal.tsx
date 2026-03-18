"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n/provider";

export function AuthModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("auth");
  const { signInWithGoogle, signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLabel = useMemo(
    () => (mode === "signin" ? t("signInCta") : t("signUpCta")),
    [mode, t]
  );

  async function handlePasswordAuth() {
    if (!email.trim() || !password.trim()) {
      setError(t("missingFields"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (mode === "signin") {
        await signInWithPassword(email.trim(), password);
      } else {
        await signUpWithPassword(email.trim(), password);
      }
      onOpenChange(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (nextError) {
      setSubmitting(false);
      setError(nextError instanceof Error ? nextError.message : t("genericError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/6 bg-discord-mid text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("title")}</DialogTitle>
          <DialogDescription className="text-sm text-discord-muted">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button
            type="button"
            onClick={() => void handleGoogle()}
            disabled={submitting}
            className="w-full bg-white text-black hover:bg-white/90"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("google")}
          </Button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-discord-muted">
            <div className="h-px flex-1 bg-white/8" />
            <span>{t("or")}</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          <div className="grid grid-cols-2 rounded-xl bg-discord-dark p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-lg px-3 py-2 transition-colors ${
                mode === "signin" ? "bg-discord-blurple text-white" : "text-discord-muted"
              }`}
            >
              {t("signIn")}
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-lg px-3 py-2 transition-colors ${
                mode === "signup" ? "bg-discord-blurple text-white" : "text-discord-muted"
              }`}
            >
              {t("signUp")}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                {t("email")}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 border-white/8 bg-discord-dark text-foreground placeholder:text-discord-muted"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                {t("password")}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="mt-2 border-white/8 bg-discord-dark text-foreground placeholder:text-discord-muted"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handlePasswordAuth();
                  }
                }}
              />
            </div>
          </div>

          {error && <p className="text-sm text-discord-red">{error}</p>}

          <Button
            type="button"
            onClick={() => void handlePasswordAuth()}
            disabled={submitting}
            className="w-full bg-discord-blurple text-white hover:bg-discord-blurple/85"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
