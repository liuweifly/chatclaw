import "server-only";

import { existsSync } from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { isValidAgentId, resolveAgentPaths } from "@/lib/agent-security";
import type { AgentSpecialty } from "@/types";

function generateSoul(name: string, description: string, specialty: AgentSpecialty) {
  const specialtyTraits: Record<AgentSpecialty, string> = {
    coding: `You are an expert software engineer. You write clean, efficient, and well-tested code.
You excel at debugging, architecture design, and explaining technical concepts clearly.
You prefer practical solutions over theoretical ones.`,
    research: `You are a thorough researcher with excellent analytical skills.
You synthesize information from multiple sources, identify patterns, and provide well-structured summaries.
You always cite your reasoning and acknowledge uncertainty.`,
    writing: `You are a skilled writer and communicator.
You craft clear, engaging content adapted to the audience and purpose.
You excel at structuring ideas, editing for clarity, and maintaining consistent tone.`,
    design: `You are a creative designer with strong aesthetic sensibility.
You think in terms of user experience, visual hierarchy, and accessibility.
You provide actionable design feedback and can describe visual concepts clearly.`,
    general: `You are a helpful and versatile assistant.
You adapt your communication style to the task at hand.
You are thorough, precise, and proactive in offering relevant suggestions.`,
  };

  return `# Soul of ${name}

${description || `I am ${name}, an AI agent.`}

## Personality

${specialtyTraits[specialty]}

## Communication Style

- Be concise but thorough
- Use markdown formatting when helpful
- Provide examples when explaining concepts
- Ask clarifying questions when the request is ambiguous
`;
}

function generateAgentInstructions(name: string, specialty: AgentSpecialty) {
  const specialtyInstructions: Record<AgentSpecialty, string> = {
    coding: `## Coding Guidelines
- Write clean, readable code with appropriate comments
- Follow the project's existing conventions
- Include error handling and edge cases
- Suggest tests when appropriate`,
    research: `## Research Guidelines
- Provide structured findings with clear sections
- Distinguish between facts, analysis, and speculation
- Include relevant context and background
- Summarize key takeaways`,
    writing: `## Writing Guidelines
- Match tone and style to the intended audience
- Use clear structure with headings and sections
- Edit for conciseness and clarity
- Proofread for grammar and consistency`,
    design: `## Design Guidelines
- Consider accessibility and usability
- Think about responsive design
- Follow established design systems when applicable
- Provide rationale for design decisions`,
    general: `## General Guidelines
- Be helpful and proactive
- Adapt approach to the specific task
- Ask clarifying questions when needed
- Provide actionable suggestions`,
  };

  return `# Agent Instructions for ${name}

${specialtyInstructions[specialty]}

## Response Format
- Use markdown for structured responses
- Keep responses focused and relevant
- Provide step-by-step guidance for complex tasks
`;
}

async function readOpenClawConfig(configPath: string) {
  if (!existsSync(configPath)) {
    return {} as Record<string, unknown>;
  }

  try {
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function ensureAgentList(config: Record<string, unknown>) {
  if (!config.agents || typeof config.agents !== "object") {
    config.agents = { list: [] };
  }

  const agents = config.agents as {
    list?: Array<{ id: string; name: string; workspace: string }>;
  };

  if (!Array.isArray(agents.list)) {
    agents.list = [];
  }

  return agents.list;
}

export async function provisionAgentWorkspace(opts: {
  agentId: string;
  name: string;
  description: string;
  specialty: AgentSpecialty;
}) {
  if (!isValidAgentId(opts.agentId)) {
    throw new Error("Invalid agentId");
  }

  const { workspaceDir, configPath } = resolveAgentPaths(opts.agentId);
  await mkdir(workspaceDir, { recursive: true });

  const identityContent = `# ${opts.name}

Agent ID: ${opts.agentId}
Specialty: ${opts.specialty}
`;
  await writeFile(join(workspaceDir, "IDENTITY.md"), identityContent, "utf-8");
  await writeFile(
    join(workspaceDir, "SOUL.md"),
    generateSoul(opts.name, opts.description, opts.specialty),
    "utf-8"
  );
  await writeFile(
    join(workspaceDir, "AGENTS.md"),
    generateAgentInstructions(opts.name, opts.specialty),
    "utf-8"
  );

  const config = await readOpenClawConfig(configPath);
  const agents = ensureAgentList(config);
  const existing = agents.find((entry) => entry.id === opts.agentId);
  if (existing) {
    existing.name = opts.name;
    existing.workspace = workspaceDir;
  } else {
    agents.push({
      id: opts.agentId,
      name: opts.name,
      workspace: workspaceDir,
    });
  }

  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  return { workspaceDir };
}

export async function removeAgentWorkspace(agentId: string) {
  if (!isValidAgentId(agentId)) {
    throw new Error("Invalid agentId");
  }

  const { workspaceDir, configPath } = resolveAgentPaths(agentId);

  if (existsSync(workspaceDir)) {
    await rm(workspaceDir, { recursive: true, force: true });
  }

  if (!existsSync(configPath)) {
    return;
  }

  try {
    const config = await readOpenClawConfig(configPath);
    const agents = ensureAgentList(config);
    config.agents = {
      ...(typeof config.agents === "object" && config.agents ? config.agents : {}),
      list: agents.filter((entry) => entry.id !== agentId),
    };
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch {
    // Ignore malformed OpenClaw config during cleanup.
  }
}
