"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { testConnection } from "@/lib/gateway";
import { useStore } from "@/lib/store";
import type { Company } from "@/types";

function GatewaySettingsForm({
  company,
  connectionStatus,
  onClose,
}: {
  company: Company;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  onClose: () => void;
}) {
  const { actions } = useStore();
  const [name, setName] = useState(company.name);
  const [description, setDescription] = useState(company.description || "");
  const [gatewayUrl, setGatewayUrl] = useState(company.gatewayUrl || "");
  const [gatewayToken, setGatewayToken] = useState(company.gatewayToken || "");
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

  async function handleTest() {
    if (!gatewayUrl || !gatewayToken) return;
    setTestState("testing");
    setTestError("");
    const result = await testConnection(gatewayUrl, gatewayToken);
    if (result.ok) {
      setTestState("success");
    } else {
      setTestState("error");
      setTestError(result.error || "Connection failed");
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    await actions.updateCompany(company.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      gatewayUrl: gatewayUrl.trim(),
      gatewayToken: gatewayToken.trim(),
    });
    onClose();
  }

  async function handleDelete() {
    await actions.deleteCompany(company.id);
    onClose();
  }

  async function handleDetect() {
    try {
      const res = await fetch("/api/detect-gateway");
      const data = await res.json();
      if (data.found) {
        setGatewayUrl(data.url);
        setGatewayToken(data.token);
        setTestState("idle");
      }
    } catch {
      // Failed to detect
    }
  }

  return (
    <>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-discord-muted">
            Company Name
          </label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 border-none bg-discord-dark text-foreground"
          />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-discord-muted">
            Description
          </label>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-2 border-none bg-discord-dark text-foreground"
          />
        </div>

        <div className="border-t border-discord-dark pt-2">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-discord-muted">
              Gateway Connection
            </label>
            <div className="flex items-center gap-1.5 text-xs">
              {connectionStatus === "connected" ? (
                <>
                  <Wifi className="h-3 w-3 text-discord-green" />
                  <span className="text-discord-green">Connected</span>
                </>
              ) : connectionStatus === "connecting" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-discord-yellow" />
                  <span className="text-discord-yellow">Connecting</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-discord-muted" />
                  <span className="text-discord-muted">Disconnected</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-discord-muted">Gateway URL</label>
              <Input
                value={gatewayUrl}
                onChange={(event) => {
                  setGatewayUrl(event.target.value);
                  setTestState("idle");
                }}
                placeholder="ws://localhost:18789"
                className="mt-1 border-none bg-discord-dark font-mono text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs text-discord-muted">API Token</label>
              <Input
                type="password"
                value={gatewayToken}
                onChange={(event) => {
                  setGatewayToken(event.target.value);
                  setTestState("idle");
                }}
                placeholder="Your gateway token"
                className="mt-1 border-none bg-discord-dark font-mono text-sm text-foreground"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleTest}
                disabled={!gatewayUrl || !gatewayToken || testState === "testing"}
                className="flex-1 bg-discord-dark text-foreground hover:bg-discord-darker"
              >
                {testState === "testing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {testState === "success" && (
                  <CheckCircle2 className="mr-2 h-4 w-4 text-discord-green" />
                )}
                {testState === "error" && (
                  <XCircle className="mr-2 h-4 w-4 text-discord-red" />
                )}
                Test
              </Button>
              <Button
                variant="secondary"
                onClick={handleDetect}
                className="bg-discord-dark text-foreground hover:bg-discord-darker"
              >
                Auto-detect
              </Button>
            </div>

            {testError && <p className="text-sm text-discord-red">{testError}</p>}
          </div>
        </div>
      </div>

      <DialogFooter className="flex-row justify-between sm:justify-between">
        <Button
          variant="destructive"
          onClick={handleDelete}
          className="bg-discord-red hover:bg-discord-red/80"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Company
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name.trim()}
          className="bg-discord-blurple text-white hover:bg-discord-blurple/80"
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

export function GatewaySettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state } = useStore();
  const company = state.companies.find((entry) => entry.id === state.activeCompanyId);

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-none bg-discord-mid text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
        </DialogHeader>
        <GatewaySettingsForm
          key={`${company.id}:${company.updatedAt}:${open ? "open" : "closed"}`}
          company={company}
          connectionStatus={state.connectionStatus}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
