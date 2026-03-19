---
name: agent-bootstrap
description: Plan and report manual validation for ChatClaw agent create/delete/bootstrap changes after baseline verification. Use when changes touch agent bootstrap paths such as `src/app/api/agents/**`, `src/lib/agent-security.ts`, `src/app/api/bootstrap/route.ts`, `src/lib/gateway-config.ts`, or agent create/delete logic in `src/lib/store.tsx`.
---

# Agent Bootstrap

Use this skill after the baseline code-change verification passes and the change needs real validation against the local `.openclaw` bootstrap flow.

## Workflow

1. Run baseline verification first.
   - Use `bash skills/code-change-verification/scripts/run-checks.sh <files...>`.
2. Generate the targeted bootstrap checklist.
   - Run `bash skills/agent-bootstrap/scripts/plan-bootstrap.sh <files...>`.
   - Add `--full` when the change spans create, delete, and bootstrap discovery together.
3. Execute the checklist with a disposable agent in a safe local environment.
   - Use a logged-in user who owns the workspace under test.
   - Prefer a throwaway agent name and ID.
   - Be aware that the flow writes to `~/.openclaw/openclaw.json` and `~/.openclaw/workspace-<agentId>`.
4. Report results per scenario.
   - Include the disposable agent ID used.
   - Note pass/fail, filesystem/config evidence, and any cleanup left behind.

## Current Coverage

- Covers manual validation for:
  - Agent creation route behavior
  - Workspace file generation
  - `openclaw.json` registration
  - Agent deletion cleanup
  - Bootstrap discovery and validation guardrails when in scope
- Does not automate the file writes or API calls.

## Resources

- `scripts/plan-bootstrap.sh`: Maps changed files to the most relevant manual bootstrap scenarios and prints expected evidence.
