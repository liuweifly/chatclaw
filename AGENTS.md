# ChatClaw Repo Instructions

## Skills

- Use `skills/code-change-verification` when changes touch runtime code, API routes, gateway or streaming logic, i18n resources, or agent bootstrap flows.
- Use `skills/chat-flow-smoke` after baseline verification when changes touch chat streaming, team sequencing, abort handling, chat UI, or gateway detection behavior.
- Use `skills/agent-bootstrap` after baseline verification when changes touch agent creation, deletion, bootstrap discovery, or `.openclaw` path resolution logic.
- Trigger files usually include:
  - `src/app/api/**`
  - `src/lib/gateway.ts`
  - `src/lib/gateway-config.ts`
  - `src/lib/store.tsx`
  - `src/components/chat-area.tsx`
  - `src/lib/agent-security.ts`
  - `src/app/api/agents/**`
  - `src/app/api/bootstrap/route.ts`
  - `src/i18n/**`
  - `scripts/verify-i18n.mjs`
- Prefer running the bundled script with explicit file paths:
  - `bash skills/code-change-verification/scripts/run-checks.sh <changed-file>...`
- If the changed file list is unclear, run the script with no arguments so it can inspect the current git working tree.
- For chat-path changes, run these in order:
  - `bash skills/code-change-verification/scripts/run-checks.sh <changed-file>...`
  - `bash skills/chat-flow-smoke/scripts/plan-smoke.sh <changed-file>...`
- For agent bootstrap changes, run these in order:
  - `bash skills/code-change-verification/scripts/run-checks.sh <changed-file>...`
  - `bash skills/agent-bootstrap/scripts/plan-bootstrap.sh <changed-file>...`

## Verification Policy

- Treat `pnpm lint` and `pnpm build` as the default minimum verification stack for matching app/runtime changes.
- Add `pnpm verify:i18n` when i18n files changed.
- When changes touch chat streaming or multi-agent sequencing, especially `src/lib/store.tsx`, `src/lib/gateway.ts`, or `src/app/api/chat/route.ts`, call out that manual chat-flow smoke coverage is still required because the repo does not yet have automated flow tests.

## Commit Policy

- After completing a code task with successful verification, create a git commit by default unless the user explicitly says not to commit.
- Use the available `git-auto-commit` skill/workflow to inspect the diff, derive the commit message, stage changes, and commit.
- Prefer Conventional Commits such as `feat(...)`, `fix(...)`, `refactor(...)`, `chore(...)`, `docs(...)`, or `test(...)`.
- Before editing, inspect the current worktree so pre-existing unrelated changes are known.
- If unrelated changes already exist, do not blindly run `git add -A`.
- Unrelated changes are not a blocker to auto-commit. Stage and commit only the files owned by the current task.
- Ask only when the task boundary is ambiguous or the same file contains mixed changes that cannot be safely separated.
- Do not auto-commit failed or partial work.
- In the final response, report the commit message and short commit SHA when an automatic commit was created.

## Repo Notes

- Use `pnpm` for repo scripts.
- `TEST_CASES.md` is the current source of truth for manual QA flows.
- Keep skill instructions lean; put mechanical actions in scripts whenever possible.
