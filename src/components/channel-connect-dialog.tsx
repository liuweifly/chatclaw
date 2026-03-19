"use client";

import { CheckCircle2, ExternalLink, Plug2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "@/i18n/provider";

type ChannelKey = "telegram" | "feishu" | "discord";

export function ChannelConnectDialog({
  channel,
  open,
  onOpenChange,
  onOpenSettings,
}: {
  channel: Exclude<ChannelKey, "web" | "slack"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}) {
  const t = useTranslations("workspace.panels.channels.modal");

  if (!channel) {
    return null;
  }

  const steps = [0, 1, 2] as const;
  const channelName = t(`channels.${channel}.name`);

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
          <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
            <p className="text-sm font-medium text-foreground">{t("beforeYouStart")}</p>
            <p className="mt-2 text-sm leading-6 text-discord-muted">
              {t("beforeYouStartBody")}
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step}
                className="flex gap-3 rounded-2xl border border-white/6 bg-black/10 p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-discord-blurple/20 text-sm font-semibold text-discord-blurple">
                  {step + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {t(`steps.${step}.title`, { channel: channelName })}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-discord-muted">
                    {t(`steps.${step}.body`, { channel: channelName })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#23a55a]/20 bg-[#23a55a]/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#23a55a]" />
              <p className="text-sm leading-6 text-foreground">{t("footer")}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="bg-discord-dark text-foreground hover:bg-discord-darker"
          >
            {t("close")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onOpenSettings();
            }}
            className="bg-discord-blurple text-white hover:bg-discord-blurple/85"
          >
            <Settings2 className="h-4 w-4" />
            {t("openSettings")}
            <ExternalLink className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
