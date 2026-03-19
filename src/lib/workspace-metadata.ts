import type { Agent, AgentSpecialty, AgentTeam, Company } from "@/types";
import type {
  LobsterAgentRecord,
  LobsterRecord,
  LobsterTeamRecord,
} from "@/lib/supabase/shared";

export interface WorkspaceMetadataResponse {
  companies: Company[];
  agents: Agent[];
  teams: AgentTeam[];
}

function parseTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeSpecialty(value: string | null | undefined): AgentSpecialty {
  switch (value) {
    case "coding":
    case "research":
    case "writing":
    case "design":
    case "general":
      return value;
    default:
      return "general";
  }
}

export function mapLobsterRecordToCompany(record: LobsterRecord): Company {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? undefined,
    defaultAgentId: record.agent_id ?? undefined,
    createdAt: parseTimestamp(record.created_at),
    updatedAt: parseTimestamp(record.updated_at),
  };
}

export function mapLobsterAgentRecordToAgent(record: LobsterAgentRecord): Agent {
  return {
    id: record.id,
    companyId: record.company_id,
    name: record.name,
    avatar: record.avatar_url ?? undefined,
    description: record.description,
    specialty: normalizeSpecialty(record.specialty),
    createdAt: parseTimestamp(record.created_at),
  };
}

export function mapLobsterTeamRecordToTeam(record: LobsterTeamRecord): AgentTeam {
  return {
    id: record.id,
    companyId: record.company_id,
    name: record.name,
    description: record.description ?? undefined,
    agentIds: Array.isArray(record.agent_ids) ? record.agent_ids : [],
    createdAt: parseTimestamp(record.created_at),
  };
}
