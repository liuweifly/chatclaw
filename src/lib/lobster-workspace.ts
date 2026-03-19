import type { ChatTargetType, Message } from "@/types";

export interface LobsterWorkspaceSkill {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  active: boolean;
  installable: boolean;
  source: "runtime" | "custom" | "curated" | "bundled";
  location?: string;
}

export interface LobsterWorkspaceMemoryEntry {
  id: string;
  kind: "long_term" | "note";
  name: string;
  relativePath: string;
  updatedAt: string;
  size: number;
  preview: string | null;
}

export interface LobsterWorkspaceSession {
  id: string;
  sessionKey: string;
  updatedAt: string;
  source: string | null;
  originLabel: string | null;
  chatType: string | null;
  messageCount: number;
  lastUserMessage: string | null;
  lastAssistantMessage: string | null;
}

export interface LobsterWorkspaceSnapshot {
  companyId: string;
  agentId: string;
  workspaceDir: string;
  skills: LobsterWorkspaceSkill[];
  memoryEntries: LobsterWorkspaceMemoryEntry[];
  sessions: LobsterWorkspaceSession[];
}

export interface LobsterWorkspaceResponse {
  snapshot: LobsterWorkspaceSnapshot;
}

export interface LobsterWorkspaceChatHistory {
  targetType: ChatTargetType;
  targetId: string;
  messages: Message[];
}

export interface LobsterWorkspaceChatResponse {
  history: LobsterWorkspaceChatHistory;
}
