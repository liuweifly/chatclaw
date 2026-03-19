import { homedir } from "os";
import { resolve, sep } from "path";
import { createServerClient } from "@/lib/supabase/server";
import type { LobsterRecord } from "@/lib/supabase/shared";

export const AGENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidAgentId(agentId: string) {
  return AGENT_ID_PATTERN.test(agentId);
}

export function resolveAgentPaths(agentId: string) {
  if (!isValidAgentId(agentId)) {
    throw new Error("Invalid agentId");
  }

  const openclawDir = resolve(homedir(), ".openclaw");
  const workspaceDir = resolve(openclawDir, `workspace-${agentId}`);
  const allowedPrefix = `${openclawDir}${sep}`;

  if (!workspaceDir.startsWith(allowedPrefix)) {
    throw new Error("Resolved agent path is outside the OpenClaw directory");
  }

  return {
    openclawDir,
    workspaceDir,
    configPath: resolve(openclawDir, "openclaw.json"),
  };
}

export async function getOwnedWorkspace(userId: string, companyId: string) {
  const supabase = createServerClient();

  return supabase.db.select<LobsterRecord | null>("lobsters", {
    filters: {
      id: companyId,
      user_id: userId,
    },
    maybeSingle: true,
  });
}
