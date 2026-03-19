import { NextResponse } from "next/server";
import {
  installCuratedSkillForLobster,
  readLobsterWorkspaceSnapshot,
} from "@/lib/lobster-workspace-server";
import { getServerUser } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { companyId } = await context.params;
    const snapshot = await readLobsterWorkspaceSnapshot(user.id, companyId);

    if (!snapshot) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "This lobster is missing agent_id"
        ? 400
        : message === "Could not locate the VPS workspace for this lobster"
          ? 404
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { companyId } = await context.params;
    const body = (await request.json()) as {
      action?: string;
      skillId?: string;
    };

    if (body.action !== "installSkill" || !body.skillId) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const snapshot = await installCuratedSkillForLobster(user.id, companyId, body.skillId);
    if (!snapshot) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Invalid skill id"
        ? 400
        : message === "Skill not found in curated catalog"
          ? 404
          : message === "Skill is already installed"
            ? 409
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
