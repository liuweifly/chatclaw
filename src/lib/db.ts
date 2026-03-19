import Dexie, { type EntityTable } from "dexie";
import type { Company, Agent, AgentTeam, Message } from "@/types";

const LEGACY_DB_NAME = "chatclaw";
const SCOPED_DB_PREFIX = "chatclaw:";

type ChatClawDb = Dexie & {
  companies: EntityTable<Company, "id">;
  agents: EntityTable<Agent, "id">;
  teams: EntityTable<AgentTeam, "id">;
  messages: EntityTable<Message, "id">;
};

const dbCache = new Map<string, ChatClawDb>();

function scopedDatabaseName(scope: string) {
  return `${SCOPED_DB_PREFIX}${scope}`;
}

function createDatabase(name: string): ChatClawDb {
  const db = new Dexie(name) as ChatClawDb;

  db.version(1).stores({
    companies: "id, updatedAt",
    agents: "id, companyId",
    teams: "id, companyId",
    messages: "id, [targetType+targetId], createdAt",
  });

  return db;
}

function getDb(scope: string) {
  const existing = dbCache.get(scope);
  if (existing) {
    return existing;
  }

  const db = createDatabase(scopedDatabaseName(scope));
  dbCache.set(scope, db);
  return db;
}

export function getStorageScope(userId: string | null | undefined) {
  return userId ? `user:${userId}` : "anonymous";
}

export async function purgeLegacyLocalDatabase() {
  const names = await Dexie.getDatabaseNames();
  if (names.includes(LEGACY_DB_NAME)) {
    await Dexie.delete(LEGACY_DB_NAME);
  }
}

export async function clearStorageScope(scope: string) {
  const cached = dbCache.get(scope);
  if (cached) {
    cached.close();
    dbCache.delete(scope);
  }

  await Dexie.delete(scopedDatabaseName(scope));
}

export async function clearAllStorageScopes() {
  for (const db of dbCache.values()) {
    db.close();
  }
  dbCache.clear();

  const names = await Dexie.getDatabaseNames();
  await Promise.all(
    names
      .filter((name) => name === LEGACY_DB_NAME || name.startsWith(SCOPED_DB_PREFIX))
      .map((name) => Dexie.delete(name))
  );
}

export async function getAllCompanies(scope: string): Promise<Company[]> {
  return getDb(scope).companies.orderBy("updatedAt").reverse().toArray();
}

export async function getCompany(scope: string, id: string): Promise<Company | undefined> {
  return getDb(scope).companies.get(id);
}

export async function createCompany(scope: string, company: Company): Promise<void> {
  await getDb(scope).companies.add(company);
}

export async function updateCompany(
  scope: string,
  id: string,
  updates: Partial<Company>
): Promise<void> {
  await getDb(scope).companies.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteCompany(scope: string, id: string): Promise<void> {
  const db = getDb(scope);

  await db.transaction("rw", [db.companies, db.agents, db.teams, db.messages], async () => {
    const agents = await db.agents.where("companyId").equals(id).toArray();
    const teams = await db.teams.where("companyId").equals(id).toArray();
    for (const agent of agents) {
      await db.messages.where("[targetType+targetId]").equals(["agent", agent.id]).delete();
    }
    for (const team of teams) {
      await db.messages.where("[targetType+targetId]").equals(["team", team.id]).delete();
    }
    await db.teams.where("companyId").equals(id).delete();
    await db.agents.where("companyId").equals(id).delete();
    await db.companies.delete(id);
  });
}

export async function getAgentsByCompany(scope: string, companyId: string): Promise<Agent[]> {
  return getDb(scope).agents.where("companyId").equals(companyId).toArray();
}

export async function getAgent(scope: string, id: string): Promise<Agent | undefined> {
  return getDb(scope).agents.get(id);
}

export async function createAgent(scope: string, agent: Agent): Promise<void> {
  await getDb(scope).agents.add(agent);
}

export async function updateAgent(
  scope: string,
  id: string,
  updates: Partial<Agent>
): Promise<void> {
  await getDb(scope).agents.update(id, updates);
}

export async function deleteAgent(scope: string, id: string): Promise<void> {
  const db = getDb(scope);

  await db.transaction("rw", [db.agents, db.teams, db.messages], async () => {
    const teams = await db.teams.toArray();
    for (const team of teams) {
      if (team.agentIds.includes(id)) {
        await db.teams.update(team.id, {
          agentIds: team.agentIds.filter((agentId) => agentId !== id),
        });
      }
    }
    await db.messages.where("[targetType+targetId]").equals(["agent", id]).delete();
    await db.agents.delete(id);
  });
}

export async function getTeamsByCompany(scope: string, companyId: string): Promise<AgentTeam[]> {
  return getDb(scope).teams.where("companyId").equals(companyId).toArray();
}

export async function createTeam(scope: string, team: AgentTeam): Promise<void> {
  await getDb(scope).teams.add(team);
}

export async function updateTeam(
  scope: string,
  id: string,
  updates: Partial<AgentTeam>
): Promise<void> {
  await getDb(scope).teams.update(id, updates);
}

export async function deleteTeam(scope: string, id: string): Promise<void> {
  const db = getDb(scope);

  await db.transaction("rw", db.teams, db.messages, async () => {
    await db.messages.where("[targetType+targetId]").equals(["team", id]).delete();
    await db.teams.delete(id);
  });
}

export async function getMessagesByTarget(
  scope: string,
  targetType: string,
  targetId: string
): Promise<Message[]> {
  return getDb(scope).messages
    .where("[targetType+targetId]")
    .equals([targetType, targetId])
    .sortBy("createdAt");
}

export async function addMessage(scope: string, message: Message): Promise<void> {
  await getDb(scope).messages.add(message);
}
