"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDetectedGatewayStatusMessage } from "@/lib/gateway";
import { useStore } from "@/lib/store";

export function CreateCompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { actions } = useStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [gatewayStatus, setGatewayStatus] = useState("No server gateway detected yet.");

  // Auto-detect gateway on dialog open
  useEffect(() => {
    if (open && !gatewayUrl) {
      fetch("/api/detect-gateway")
        .then((res) => res.json())
        .then((data) => {
          if (data.found) {
            setGatewayUrl(data.url);
            setGatewayStatus(getDetectedGatewayStatusMessage(data));
          } else {
            setGatewayUrl("");
            setGatewayStatus("No server gateway detected yet.");
          }
        })
        .catch(() => {});
    }
  }, [open, gatewayUrl]);

  async function handleCreate() {
    if (!name.trim()) return;
    const company = await actions.createCompany(name.trim(), description.trim() || undefined);
    await actions.selectCompany(company.id);
    setName("");
    setDescription("");
    setGatewayUrl("");
    setGatewayStatus("No server gateway detected yet.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-discord-mid border-none text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">Create Demo Workspace</DialogTitle>
          <p className="text-sm text-discord-muted text-center">
            Save a workspace for your operator, gateway, and demo chats.
          </p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-discord-muted">
              Workspace Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hosted OpenClaw Demo"
              className="mt-2 bg-discord-dark border-none text-foreground placeholder:text-discord-muted"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-discord-muted">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should this workspace help you demo?"
              className="mt-2 bg-discord-dark border-none text-foreground placeholder:text-discord-muted"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-discord-muted">
              Server Gateway
            </label>
            <div className="mt-2 rounded-md bg-discord-dark px-3 py-2 text-sm text-discord-muted">
              {gatewayUrl ? (
                <>
                  <p className="font-mono text-foreground">{gatewayUrl}</p>
                  <p className="mt-1">{gatewayStatus}</p>
                </>
              ) : (
                <p>{gatewayStatus}</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="w-full bg-discord-blurple hover:bg-discord-blurple/80 text-white"
          >
            Create Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
