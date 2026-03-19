"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Plug2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n/provider";
import type { ChannelSummary } from "@/lib/channel-integrations";

type ChannelKey = "telegram" | "feishu";

export function ChannelConnectDialog({
  channel,
  integration,
  pending,
  error,
  onConnectTelegram,
  onStartFeishu,
  onDisconnect,
  open,
  onOpenChange,
  onOpenSettings,
}: {
  channel: ChannelKey | null;
  integration: ChannelSummary | null;
  pending: "connect" | "disconnect" | null;
  error: string | null;
  onConnectTelegram: (token: string) => Promise<void>;
  onStartFeishu: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}) {
  const t = useTranslations("workspace.panels.channels.modal");
  const [telegramToken, setTelegramToken] = useState("");

  useEffect(() => {
    if (!open) {
      setTelegramToken("");
    }
  }, [open, channel]);

  if (!channel) {
    return null;
  }

  const channelName = t(`channels.${channel}.name`);
  const connected = integration?.status === "connected";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/6 bg-discord-mid text-foreground sm:max-w-lg">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-discord-blurple/20 bg-discord-blurple/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-discord-blurple">
            <Plug2 className="h-3.5 w-3.5" />
            {t("eyebrow")}
          </div>
          <DialogTitle className="mt-3 text-xl">
            {t("title", { channel: channelName })}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-discord-muted">
            {t(`channels.${channel}.description`)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {connected && (
            <div className="rounded-2xl border border-[#23a55a]/20 bg-[#23a55a]/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#23a55a]" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t("connectedTitle")}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-foreground">
                    {t("connectedAs", {
                      account: integration?.accountLabel || channelName,
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {integration?.details && (
            <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
              <p className="text-sm leading-6 text-discord-muted">{integration.details}</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-discord-red/30 bg-discord-red/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-discord-red" />
                <p className="text-sm leading-6 text-foreground">{error}</p>
              </div>
            </div>
          )}

          {channel === "telegram" ? (
            <div className="space-y-3 rounded-2xl border border-white/6 bg-black/10 p-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-discord-muted">
                  {t("telegram.tokenLabel")}
                </label>
                <Input
                  value={telegramToken}
                  onChange={(event) => setTelegramToken(event.target.value)}
                  placeholder={t("telegram.tokenPlaceholder")}
                  className="mt-2 border-white/8 bg-discord-dark text-foreground placeholder:text-discord-muted"
                />
              </div>
              <p className="text-sm leading-6 text-discord-muted">
                {t("telegram.help")}
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-white/6 bg-black/10 p-4">
              <p className="text-sm font-medium text-foreground">{t("feishu.installTitle")}</p>
              <p className="text-sm leading-6 text-discord-muted">
                {t("feishu.installBody")}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="bg-discord-dark text-foreground hover:bg-discord-darker"
              >
                {t("close")}
              </Button>
              {integration?.canDisconnect && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending === "disconnect"}
                  onClick={() => void onDisconnect()}
                  className="bg-discord-dark text-foreground hover:bg-discord-darker"
                >
                  {t("disconnect")}
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {!integration?.canConnect && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenSettings();
                  }}
                  className="bg-discord-dark text-foreground hover:bg-discord-darker"
                >
                  <Settings2 className="h-4 w-4" />
                  {t("openSettings")}
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              {channel === "telegram" ? (
                <Button
                  type="button"
                  disabled={pending === "connect" || !telegramToken.trim()}
                  onClick={() => void onConnectTelegram(telegramToken)}
                  className="bg-discord-blurple text-white hover:bg-discord-blurple/85"
                >
                  {connected ? t("reconnect") : t("connect")}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={pending === "connect" || !integration?.canConnect}
                  onClick={() => void onStartFeishu()}
                  className="bg-discord-blurple text-white hover:bg-discord-blurple/85"
                >
                  {t("feishu.installCta")}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
