---
name: code-change-verification
description: Run ChatClaw's standard post-change verification for runtime, API route, gateway, i18n, and agent bootstrap work. Use when changes touch `src/app/api/**`, gateway or streaming files under `src/lib/`, i18n files under `src/i18n/**`, agent bootstrap files such as `src/app/api/agents/**` and `src/lib/agent-security.ts`, or other app runtime code that should be checked with the repo's minimum validation stack.
---

# Code Change Verification

Use the bundled script to choose and run ChatClaw's minimum verification stack in a consistent order.

## Workflow

1. Identify the relevant changed files.
   - Prefer passing explicit paths to the script.
   - If the changed set is unclear, run the script with no file arguments and let it inspect the current git working tree.
2. Run `bash skills/code-change-verification/scripts/run-checks.sh <files...>`.
   - Add `--force` to run the default stack even if the changed files do not match the usual trigger paths.
   - Add `--dry-run` to preview the planned commands without executing them.
3. Read the summary printed by the script.
   - `pnpm lint` and `pnpm build` are the default minimum checks.
   - `pnpm verify:i18n` is added when i18n-related files changed.
4. Report the outcome.
   - List the changed scope categories the script detected.
   - State which commands ran, which were skipped, and whether each passed.
   - Call out residual risk when the change touches chat flow or gateway behavior, because this skill does not exercise live streaming or multi-agent sequencing.

## Current Coverage

- Covers the repo's existing baseline scripts from `package.json`.
- Helps standardize verification for:
  - Runtime code
  - API routes
  - Gateway and streaming code
  - i18n resources
  - Agent bootstrap code
- Does not replace manual chat-flow testing from `TEST_CASES.md`.

## Resources

- `scripts/run-checks.sh`: Detects matching change areas, runs the baseline checks, and prints a compact summary.
