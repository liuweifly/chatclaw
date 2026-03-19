import "server-only";

import { access, cp, mkdir, open, readdir, readFile, stat } from "fs/promises";
import { constants } from "fs";
import { homedir } from "os";
import { basename, isAbsolute, join, resolve, sep } from "path";
import { getOwnedWorkspace, resolveAgentPaths } from "@/lib/agent-security";
import {
  fetchRemoteGatewayAgents,
  getGatewayConfig,
  getLocalGatewayAgents,
} from "@/lib/gateway-config";
import type {
  LobsterWorkspaceChatHistory,
  LobsterWorkspaceMemoryEntry,
  LobsterWorkspaceSession,
  LobsterWorkspaceSkill,
  LobsterWorkspaceSnapshot,
} from "@/lib/lobster-workspace";
import type { ChatTargetType, Message } from "@/types";

interface WorkspaceContext {
  companyId: string;
  agentId: string;
  workspaceDir: string;
  openclawDir: string;
  codexHome: string;
}

interface SessionRegistryEntry {
  sessionId?: string;
  updatedAt?: number;
  chatType?: string;
  lastChannel?: string;
  origin?: {
    label?: string;
    provider?: string;
  };
  sessionFile?: string;
  skillsSnapshot?: {
    resolvedSkills?: Array<{
      name?: string;
      description?: string;
      baseDir?: string;
      filePath?: string;
      source?: string;
    }>;
    skills?: Array<{
      name?: string;
    }>;
  };
}

interface SessionRegistryMatch extends SessionRegistryEntry {
  agentId: string;
  sessionKey: string;
}

interface SessionMessageLine {
  type?: string;
  id?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
    timestamp?: number | string;
  };
}

const SKILL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function coerceString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function pathExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function parseMessageTimestamp(record: SessionMessageLine) {
  const outerTimestamp = coerceString(record.timestamp);
  if (outerTimestamp) {
    const parsed = Date.parse(outerTimestamp);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const innerTimestamp = record.message?.timestamp;
  if (typeof innerTimestamp === "number" && Number.isFinite(innerTimestamp)) {
    return innerTimestamp;
  }

  if (typeof innerTimestamp === "string") {
    const parsed = Date.parse(innerTimestamp);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function normalizeWorkspaceMessageText(role: "user" | "assistant", rawText: string) {
  const text = rawText.trim();
  if (!text) {
    return "";
  }

  if (role === "user" && text.startsWith("A new session was started via /new or /reset.")) {
    return "";
  }

  if (role === "assistant") {
    if (text === "NO_REPLY") {
      return "";
    }
    if (text.startsWith("✅ New session started")) {
      return "";
    }
  }

  return text;
}

function extractTeamUserMessage(text: string) {
  const marker = "[New user message]";
  const markerIndex = text.lastIndexOf(marker);

  if (markerIndex < 0) {
    return text.trim();
  }

  return text.slice(markerIndex + marker.length).trim();
}

async function loadSessionRegistry(openclawDir: string, agentId: string) {
  const sessionsRoot = join(openclawDir, "agents", agentId, "sessions");
  const sessionsIndexPath = join(sessionsRoot, "sessions.json");

  if (!(await pathExists(sessionsIndexPath))) {
    return [] as SessionRegistryMatch[];
  }

  const raw = await readFile(sessionsIndexPath, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, SessionRegistryEntry>;

  return Object.entries(parsed)
    .map(([sessionKey, value]) => ({ agentId, sessionKey, ...value }))
    .filter((entry) => entry.sessionId && typeof entry.updatedAt === "number");
}

async function readTranscriptMessages(opts: {
  targetType: ChatTargetType;
  targetId: string;
  agentId: string;
  sessionKey: string;
  sessionFile: string;
}) {
  if (!(await pathExists(opts.sessionFile))) {
    return [] as Message[];
  }

  const raw = await readFile(opts.sessionFile, "utf-8");
  const messages: Message[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const record = JSON.parse(trimmed) as SessionMessageLine;
      if (record.type !== "message") {
        continue;
      }

      const role = coerceString(record.message?.role);
      if (role !== "user" && role !== "assistant") {
        continue;
      }

      let text = normalizeWorkspaceMessageText(role, readTextContent(record.message?.content));
      if (!text) {
        continue;
      }

      if (opts.targetType === "team" && role === "user") {
        text = extractTeamUserMessage(text);
        if (!text) {
          continue;
        }
      }

      messages.push({
        id: `${opts.sessionKey}:${record.id ?? messages.length}`,
        targetType: opts.targetType,
        targetId: opts.targetId,
        role,
        agentId: role === "assistant" ? opts.agentId : undefined,
        content: text,
        createdAt: parseMessageTimestamp(record),
      });
    } catch {
      // Ignore malformed lines.
    }
  }

  return messages;
}

function dedupeWorkspaceMessages(messages: Message[]) {
  const sorted = [...messages].sort((left, right) => left.createdAt - right.createdAt);
  const result: Message[] = [];

  for (const message of sorted) {
    if (message.role === "user") {
      const duplicate = result.findLast(
        (entry) =>
          entry.role === "user" &&
          entry.content === message.content &&
          Math.abs(entry.createdAt - message.createdAt) <= 2 * 60 * 1000
      );

      if (duplicate) {
        continue;
      }
    }

    result.push(message);
  }

  return result;
}

function directSessionKeys(agentId: string) {
  return [`agent:${agentId}:chatclaw:dm`, `agent:${agentId}:main`];
}

function teamSessionKey(agentId: string, teamId: string) {
  return `agent:${agentId}:chatclaw:team:${teamId}`;
}

function inferOpenClawDir(workspaceDir: string) {
  const normalized = resolve(workspaceDir);
  const marker = `${sep}.openclaw${sep}`;
  const markerIndex = normalized.lastIndexOf(marker);

  if (markerIndex >= 0) {
    return normalized.slice(0, markerIndex + ".openclaw".length + 1);
  }

  return join(homedir(), ".openclaw");
}

function inferCodexHome(workspaceDir: string) {
  const normalized = resolve(workspaceDir);
  const marker = `${sep}.openclaw${sep}`;
  const markerIndex = normalized.lastIndexOf(marker);

  if (markerIndex >= 0) {
    return join(normalized.slice(0, markerIndex), ".codex");
  }

  return join(homedir(), ".codex");
}

async function resolveWorkspaceFromGateway(agentId: string) {
  const gateway = await getGatewayConfig();
  if (!gateway) {
    return null;
  }

  const agents =
    gateway.source === "env"
      ? await fetchRemoteGatewayAgents(gateway.url, gateway.token)
      : await getLocalGatewayAgents();

  const matched = agents.find((agent) => agent.id === agentId);
  const workspace = matched?.workspace?.trim();

  if (!workspace || !isAbsolute(workspace)) {
    return null;
  }

  return workspace;
}

async function resolveWorkspaceContext(userId: string, companyId: string): Promise<WorkspaceContext | null> {
  const lobster = await getOwnedWorkspace(userId, companyId);
  if (!lobster) {
    return null;
  }

  const agentId = lobster.agent_id?.trim();
  if (!agentId) {
    throw new Error("This lobster is missing agent_id");
  }

  const workspaceCandidates: string[] = [];
  const gatewayWorkspace = await resolveWorkspaceFromGateway(agentId);
  if (gatewayWorkspace) {
    workspaceCandidates.push(gatewayWorkspace);
  }

  try {
    workspaceCandidates.push(resolveAgentPaths(agentId).workspaceDir);
  } catch {
    // Ignore invalid fallback path when agent ids are not compatible with local naming.
  }

  workspaceCandidates.push(join(homedir(), ".openclaw", "workspace"));

  const workspaceDir =
    (
      await Promise.all(
        workspaceCandidates.map(async (candidate) => ((await pathExists(candidate)) ? candidate : null))
      )
    ).find((candidate): candidate is string => Boolean(candidate)) ?? null;

  if (!workspaceDir) {
    throw new Error("Could not locate the VPS workspace for this lobster");
  }

  const openclawDir = inferOpenClawDir(workspaceDir);

  return {
    companyId,
    agentId,
    workspaceDir,
    openclawDir,
    codexHome: inferCodexHome(workspaceDir),
  };
}

function titleFromSlug(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function parseSkillFrontmatter(raw: string) {
  if (!raw.startsWith("---\n")) {
    return { name: "", description: "" };
  }

  const endIndex = raw.indexOf("\n---\n", 4);
  if (endIndex < 0) {
    return { name: "", description: "" };
  }

  const frontmatter = raw.slice(4, endIndex);
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);

  return {
    name: nameMatch?.[1]?.trim() ?? "",
    description: descriptionMatch?.[1]?.trim() ?? "",
  };
}

async function readSkillMetadata(skillDir: string) {
  const skillFile = join(skillDir, "SKILL.md");
  const raw = await readFile(skillFile, "utf-8");
  const metadata = parseSkillFrontmatter(raw);
  const id = basename(skillDir);

  return {
    id,
    name: metadata.name || titleFromSlug(id),
    description: metadata.description,
    location: skillDir,
  };
}

function sourcePriority(source: LobsterWorkspaceSkill["source"]) {
  switch (source) {
    case "runtime":
      return 4;
    case "custom":
      return 3;
    case "bundled":
      return 2;
    case "curated":
    default:
      return 1;
  }
}

function mergeSkill(map: Map<string, LobsterWorkspaceSkill>, incoming: LobsterWorkspaceSkill) {
  const existing = map.get(incoming.id);
  if (!existing) {
    map.set(incoming.id, incoming);
    return;
  }

  const nextSource =
    sourcePriority(incoming.source) > sourcePriority(existing.source)
      ? incoming.source
      : existing.source;

  map.set(incoming.id, {
    ...existing,
    ...incoming,
    source: nextSource,
    name: incoming.name || existing.name,
    description: incoming.description || existing.description,
    location: incoming.location || existing.location,
    installed: existing.installed || incoming.installed,
    active: existing.active || incoming.active,
    installable: existing.installable || incoming.installable,
  });
}

async function listInstalledCustomSkills(codexHome: string) {
  const installedRoot = join(codexHome, "skills");
  if (!(await pathExists(installedRoot))) {
    return [];
  }

  const entries = await readdir(installedRoot, { withFileTypes: true });
  const skills: LobsterWorkspaceSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const skillDir = join(installedRoot, entry.name);
    if (!(await pathExists(join(skillDir, "SKILL.md")))) {
      continue;
    }

    const metadata = await readSkillMetadata(skillDir);
    skills.push({
      ...metadata,
      installed: true,
      active: false,
      installable: false,
      source: "custom",
    });
  }

  return skills;
}

async function listCuratedSkills(codexHome: string) {
  const curatedRoot = join(codexHome, "vendor_imports", "skills", "skills", ".curated");
  if (!(await pathExists(curatedRoot))) {
    return [];
  }

  const entries = await readdir(curatedRoot, { withFileTypes: true });
  const skills: LobsterWorkspaceSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const skillDir = join(curatedRoot, entry.name);
    if (!(await pathExists(join(skillDir, "SKILL.md")))) {
      continue;
    }

    const metadata = await readSkillMetadata(skillDir);
    skills.push({
      ...metadata,
      installed: false,
      active: false,
      installable: true,
      source: "curated",
    });
  }

  return skills;
}

function readTextContent(content: unknown) {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const record = item as Record<string, unknown>;
      if (record.type === "text" && typeof record.text === "string") {
        return [record.text];
      }

      return [];
    })
    .join("\n")
    .trim();
}

async function readTail(filePath: string, maxBytes: number) {
  const handle = await open(filePath, "r");

  try {
    const stats = await handle.stat();
    const start = Math.max(0, stats.size - maxBytes);
    const buffer = Buffer.alloc(stats.size - start);
    await handle.read(buffer, 0, buffer.length, start);
    return buffer.toString("utf-8");
  } finally {
    await handle.close();
  }
}

async function readRecentSessions(context: WorkspaceContext) {
  const sessionsRoot = join(context.openclawDir, "agents", context.agentId, "sessions");
  const sessionsIndexPath = join(sessionsRoot, "sessions.json");

  if (!(await pathExists(sessionsIndexPath))) {
    return {
      runtimeSkills: [] as LobsterWorkspaceSkill[],
      sessions: [] as LobsterWorkspaceSession[],
    };
  }

  const raw = await readFile(sessionsIndexPath, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, SessionRegistryEntry>;
  const entries = Object.entries(parsed)
    .map(([sessionKey, value]) => ({ sessionKey, ...value }))
    .filter((entry) => entry.sessionId && typeof entry.updatedAt === "number")
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));

  const latestWithSkills = entries.find(
    (entry) =>
      Array.isArray(entry.skillsSnapshot?.resolvedSkills) ||
      Array.isArray(entry.skillsSnapshot?.skills)
  );

  const runtimeSkillMap = new Map<string, LobsterWorkspaceSkill>();

  for (const skill of latestWithSkills?.skillsSnapshot?.resolvedSkills ?? []) {
    const skillName = coerceString(skill.name);
    if (!skillName) {
      continue;
    }

    const filePath = coerceString(skill.filePath);
    const baseDir = coerceString(skill.baseDir);
    const normalizedSource = coerceString(skill.source);
    const source: LobsterWorkspaceSkill["source"] =
      normalizedSource.includes("bundled")
        ? "bundled"
        : filePath.includes(`${sep}.codex${sep}`) || baseDir.includes(`${sep}.codex${sep}`)
          ? "custom"
          : "runtime";

    runtimeSkillMap.set(skillName, {
      id: skillName,
      name: skillName,
      description: coerceString(skill.description),
      installed: true,
      active: true,
      installable: false,
      source,
      location: baseDir || filePath || undefined,
    });
  }

  if (runtimeSkillMap.size === 0) {
    for (const skill of latestWithSkills?.skillsSnapshot?.skills ?? []) {
      const skillName = coerceString(skill.name);
      if (!skillName) {
        continue;
      }

      runtimeSkillMap.set(skillName, {
        id: skillName,
        name: skillName,
        description: "",
        installed: true,
        active: true,
        installable: false,
        source: "runtime",
      });
    }
  }

  const sessions = await Promise.all(
    entries.slice(0, 6).map(async (entry) => {
      const sessionFile = coerceString(entry.sessionFile) || join(sessionsRoot, `${entry.sessionId}.jsonl`);
      let messageCount = 0;
      let lastUserMessage: string | null = null;
      let lastAssistantMessage: string | null = null;

      if (await pathExists(sessionFile)) {
        const tail = await readTail(sessionFile, 200_000);
        const lines = tail
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        for (const line of lines) {
          try {
            const record = JSON.parse(line) as {
              type?: string;
              message?: { role?: string; content?: unknown };
            };

            if (record.type !== "message") {
              continue;
            }

            const role = coerceString(record.message?.role);
            const text = readTextContent(record.message?.content);
            if (!text) {
              continue;
            }

            messageCount += 1;
            if (role === "user") {
              lastUserMessage = text;
            }
            if (role === "assistant") {
              lastAssistantMessage = text;
            }
          } catch {
            // Ignore partial JSON lines from the tail window.
          }
        }
      }

      return {
        id: entry.sessionId!,
        sessionKey: entry.sessionKey,
        updatedAt: new Date(entry.updatedAt!).toISOString(),
        source:
          coerceString(entry.origin?.provider) || coerceString(entry.lastChannel) || null,
        originLabel: coerceString(entry.origin?.label) || null,
        chatType: coerceString(entry.chatType) || null,
        messageCount,
        lastUserMessage,
        lastAssistantMessage,
      } satisfies LobsterWorkspaceSession;
    })
  );

  return {
    runtimeSkills: [...runtimeSkillMap.values()],
    sessions,
  };
}

async function readFilePreview(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    const compact = raw.replace(/\s+/g, " ").trim();
    return compact ? compact.slice(0, 240) : null;
  } catch {
    return null;
  }
}

async function readMemoryEntries(workspaceDir: string) {
  const entries: LobsterWorkspaceMemoryEntry[] = [];

  const longTermPath = join(workspaceDir, "MEMORY.md");
  if (await pathExists(longTermPath)) {
    const info = await stat(longTermPath);
    entries.push({
      id: "MEMORY.md",
      kind: "long_term",
      name: "MEMORY.md",
      relativePath: "MEMORY.md",
      updatedAt: info.mtime.toISOString(),
      size: info.size,
      preview: await readFilePreview(longTermPath),
    });
  }

  const memoryDir = join(workspaceDir, "memory");
  if (!(await pathExists(memoryDir))) {
    return entries;
  }

  const files = await readdir(memoryDir, { withFileTypes: true });
  const memoryEntries = await Promise.all(
    files
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = join(memoryDir, entry.name);
        const info = await stat(filePath);

        return {
          id: `memory/${entry.name}`,
          kind: "note",
          name: entry.name,
          relativePath: `memory/${entry.name}`,
          updatedAt: info.mtime.toISOString(),
          size: info.size,
          preview: await readFilePreview(filePath),
        } satisfies LobsterWorkspaceMemoryEntry;
      })
  );

  return [...entries, ...memoryEntries].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  );
}

function sortSkills(skills: LobsterWorkspaceSkill[]) {
  return [...skills].sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1;
    }
    if (left.installed !== right.installed) {
      return left.installed ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export async function readLobsterChatHistory(
  userId: string,
  companyId: string,
  params: {
    targetType: ChatTargetType;
    targetId: string;
    agentIds?: string[];
  }
): Promise<LobsterWorkspaceChatHistory | null> {
  const context = await resolveWorkspaceContext(userId, companyId);
  if (!context) {
    return null;
  }

  const targetAgentIds =
    params.targetType === "agent"
      ? [params.targetId]
      : (params.agentIds ?? []).filter(Boolean);

  if (targetAgentIds.length === 0) {
    return {
      targetType: params.targetType,
      targetId: params.targetId,
      messages: [],
    };
  }

  const registries = await Promise.all(
    targetAgentIds.map(async (agentId) => ({
      agentId,
      entries: await loadSessionRegistry(context.openclawDir, agentId),
    }))
  );

  const transcriptMessages = await Promise.all(
    registries.flatMap(({ agentId, entries }) => {
      const allowedKeys =
        params.targetType === "agent"
          ? directSessionKeys(agentId)
          : [teamSessionKey(agentId, params.targetId)];

      return entries
        .filter((entry) => allowedKeys.includes(entry.sessionKey))
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
        .slice(0, 1)
        .map((entry) =>
          readTranscriptMessages({
            targetType: params.targetType,
            targetId: params.targetId,
            agentId,
            sessionKey: entry.sessionKey,
            sessionFile:
              coerceString(entry.sessionFile) ||
              join(context.openclawDir, "agents", agentId, "sessions", `${entry.sessionId}.jsonl`),
          })
        );
    })
  );

  return {
    targetType: params.targetType,
    targetId: params.targetId,
    messages: dedupeWorkspaceMessages(transcriptMessages.flat()),
  };
}

export async function readLobsterWorkspaceSnapshot(
  userId: string,
  companyId: string
): Promise<LobsterWorkspaceSnapshot | null> {
  const context = await resolveWorkspaceContext(userId, companyId);
  if (!context) {
    return null;
  }

  const [{ runtimeSkills, sessions }, memoryEntries, installedSkills, curatedSkills] =
    await Promise.all([
      readRecentSessions(context),
      readMemoryEntries(context.workspaceDir),
      listInstalledCustomSkills(context.codexHome),
      listCuratedSkills(context.codexHome),
    ]);

  const skills = new Map<string, LobsterWorkspaceSkill>();

  for (const skill of runtimeSkills) {
    mergeSkill(skills, skill);
  }
  for (const skill of installedSkills) {
    mergeSkill(skills, skill);
  }
  for (const skill of curatedSkills) {
    mergeSkill(skills, skill);
  }

  return {
    companyId: context.companyId,
    agentId: context.agentId,
    workspaceDir: context.workspaceDir,
    skills: sortSkills([...skills.values()]),
    memoryEntries,
    sessions,
  };
}

export async function installCuratedSkillForLobster(userId: string, companyId: string, skillId: string) {
  if (!SKILL_ID_PATTERN.test(skillId)) {
    throw new Error("Invalid skill id");
  }

  const context = await resolveWorkspaceContext(userId, companyId);
  if (!context) {
    return null;
  }

  const curatedDir = join(
    context.codexHome,
    "vendor_imports",
    "skills",
    "skills",
    ".curated",
    skillId
  );
  const curatedSkillFile = join(curatedDir, "SKILL.md");

  if (!(await pathExists(curatedSkillFile))) {
    throw new Error("Skill not found in curated catalog");
  }

  const installedRoot = join(context.codexHome, "skills");
  const destinationDir = join(installedRoot, skillId);

  if (await pathExists(destinationDir)) {
    throw new Error("Skill is already installed");
  }

  await mkdir(installedRoot, { recursive: true });
  await cp(curatedDir, destinationDir, { recursive: true, errorOnExist: true, force: false });

  return readLobsterWorkspaceSnapshot(userId, companyId);
}
