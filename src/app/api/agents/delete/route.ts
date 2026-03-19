import { NextResponse } from "next/server";
import { readFile, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { getOwnedWorkspace, isValidAgentId, resolveAgentPaths } from "@/lib/agent-security";
import { getServerUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { companyId, agentId } = await request.json();

    if (!companyId || !agentId) {
      return NextResponse.json(
        { error: "companyId and agentId are required" },
        { status: 400 }
      );
    }

    if (!isValidAgentId(agentId)) {
      return NextResponse.json({ error: "Invalid agentId" }, { status: 400 });
    }

    const ownedWorkspace = await getOwnedWorkspace(user.id, companyId);
    if (!ownedWorkspace) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { workspaceDir, configPath } = resolveAgentPaths(agentId);

    // Remove workspace directory
    if (existsSync(workspaceDir)) {
      await rm(workspaceDir, { recursive: true, force: true });
    }

    // Update openclaw.json - remove agent from list
    if (existsSync(configPath)) {
      try {
        const raw = await readFile(configPath, "utf-8");
        const config = JSON.parse(raw);

        if (config.agents?.list && Array.isArray(config.agents.list)) {
          config.agents.list = config.agents.list.filter(
            (a: { id: string }) => a.id !== agentId
          );
          await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
        }
      } catch {
        // Config parse error, skip update
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Invalid agentId"
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown error";
    const status = message === "Invalid agentId" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
