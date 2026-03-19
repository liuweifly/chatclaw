---
name: chat-flow-smoke
description: Plan and report manual smoke coverage for ChatClaw chat-path changes after baseline verification. Use when changes touch streaming, team sequencing, abort handling, chat UI, or gateway detection paths such as `src/lib/store.tsx`, `src/lib/gateway.ts`, `src/components/chat-area.tsx`, `src/app/api/chat/route.ts`, `src/app/api/detect-gateway/route.ts`, `src/lib/gateway-config.ts`, or nearby chat runtime files.
---

# Chat Flow Smoke

Use this skill after the baseline code-change verification passes and the change still needs real chat-path validation.

## Workflow

1. Run baseline verification first.
   - Use `bash skills/code-change-verification/scripts/run-checks.sh <files...>`.
2. Generate the targeted smoke checklist.
   - Run `bash skills/chat-flow-smoke/scripts/plan-smoke.sh <files...>`.
   - Add `--full` when the change is broad and you want the full checklist even if only one file changed.
3. Execute the manual smoke plan in a real ChatClaw session.
   - Use a logged-in workspace.
   - Use a reachable gateway.
   - Have at least one DM-capable agent and one team with at least two agents when team sequencing is in scope.
4. Report results scenario by scenario.
   - State which scenarios were exercised.
   - Note prompts used, pass/fail status, and the exact regression or residual risk.

## Current Coverage

- Covers manual smoke for:
  - Gateway connection readiness
  - Single-agent DM streaming
  - Team sequential replies and context carry-forward
  - Abort/stop behavior during streaming
- Does not automate the browser or gateway.
- Does not replace deeper QA from `TEST_CASES.md`.

## Resources

- `scripts/plan-smoke.sh`: Maps changed files to the most relevant manual smoke scenarios and prints copy-ready prompts plus pass criteria.
