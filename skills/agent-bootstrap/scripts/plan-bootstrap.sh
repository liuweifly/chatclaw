#!/usr/bin/env bash

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

FULL_PLAN=0
declare -a FILES=()
declare -a SCENARIOS=()
declare -a ORDERED_SCENARIOS=(
  "create-agent"
  "workspace-files"
  "openclaw-config"
  "delete-cleanup"
  "bootstrap-discovery"
  "validation-guards"
)

usage() {
  cat <<'EOF'
Usage:
  bash skills/agent-bootstrap/scripts/plan-bootstrap.sh [--full] [files...]

Options:
  --full     Print the full bootstrap checklist even if only some scenarios match.
  -h, --help Show this help message.

Behavior:
  - If file paths are provided, classify those paths.
  - If no file paths are provided, inspect the current git working tree.
  - Print the recommended bootstrap scenarios and expected evidence.
EOF
}

while (($# > 0)); do
  case "$1" in
    --full)
      FULL_PLAN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while (($# > 0)); do
        FILES+=("$1")
        shift
      done
      break
      ;;
    *)
      FILES+=("$1")
      ;;
  esac
  shift
done

collect_changed_files() {
  {
    git diff --name-only --relative --diff-filter=ACMRTUXB 2>/dev/null || true
    git diff --cached --name-only --relative --diff-filter=ACMRTUXB 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | awk 'NF' | sort -u
}

if ((${#FILES[@]} == 0)); then
  mapfile -t FILES < <(collect_changed_files)
fi

add_scenario() {
  local scenario="$1"
  local existing

  for existing in "${SCENARIOS[@]:-}"; do
    if [[ "$existing" == "$scenario" ]]; then
      return 0
    fi
  done

  SCENARIOS+=("$scenario")
}

detect_scenarios() {
  local file

  if ((FULL_PLAN == 1)); then
    for file in "${ORDERED_SCENARIOS[@]}"; do
      add_scenario "$file"
    done
    return 0
  fi

  for file in "${FILES[@]:-}"; do
    case "$file" in
      src/app/api/agents/create/route.ts|src/lib/store.tsx)
        add_scenario "create-agent"
        ;;
    esac

    case "$file" in
      src/app/api/agents/create/route.ts|src/lib/agent-security.ts)
        add_scenario "workspace-files"
        add_scenario "openclaw-config"
        ;;
    esac

    case "$file" in
      src/app/api/agents/delete/route.ts|src/lib/store.tsx)
        add_scenario "delete-cleanup"
        ;;
    esac

    case "$file" in
      src/app/api/bootstrap/route.ts|src/lib/gateway-config.ts|src/lib/store.tsx)
        add_scenario "bootstrap-discovery"
        ;;
    esac

    case "$file" in
      src/lib/agent-security.ts|src/app/api/agents/create/route.ts|src/app/api/agents/delete/route.ts)
        add_scenario "validation-guards"
        ;;
    esac
  done
}

print_create_agent() {
  cat <<'EOF'

1. Create Agent
   Scope:
   - Verify the create route or UI flow still creates a disposable agent successfully.
   Steps:
   - Pick a disposable agent name and ID.
   - Create the agent from the UI or `POST /api/agents/create`.
   - Record the returned workspace path if using the API directly.
   Pass criteria:
   - The request succeeds with `ok: true`.
   - The new agent appears in the current workspace UI if the create flow was triggered there.
   - No unexpected 4xx/5xx response is returned for a valid owned workspace.
EOF
}

print_workspace_files() {
  cat <<'EOF'

2. Workspace Files
   Scope:
   - Verify the disposable agent workspace is created under `~/.openclaw`.
   Steps:
   - Inspect `~/.openclaw/workspace-<agentId>/`.
   - Confirm `IDENTITY.md`, `SOUL.md`, and `AGENTS.md` exist.
   - Open the files and check the generated name, ID, and specialty fields.
   Pass criteria:
   - All expected files exist.
   - `IDENTITY.md` includes the agent name and ID.
   - `SOUL.md` and `AGENTS.md` reflect the selected specialty or the general fallback.
EOF
}

print_openclaw_config() {
  cat <<'EOF'

3. openclaw.json Registration
   Scope:
   - Verify the disposable agent is registered in `~/.openclaw/openclaw.json`.
   Steps:
   - Open `~/.openclaw/openclaw.json`.
   - Find the matching entry in `agents.list`.
   Pass criteria:
   - The entry includes the expected `id`, `name`, and workspace path.
   - The agent is added only once.
EOF
}

print_delete_cleanup() {
  cat <<'EOF'

4. Delete Cleanup
   Scope:
   - Verify deleting the disposable agent removes local workspace artifacts and config entries.
   Steps:
   - Delete the same disposable agent from the UI or `POST /api/agents/delete`.
   - Re-check the workspace directory and `openclaw.json`.
   Pass criteria:
   - `~/.openclaw/workspace-<agentId>` is removed.
   - The matching `agents.list` entry is removed.
   - The app no longer shows the deleted agent in the workspace UI.
EOF
}

print_bootstrap_discovery() {
  cat <<'EOF'

5. Bootstrap Discovery
   Scope:
   - Verify bootstrap still discovers gateway agents relevant to the current user/workspace.
   Steps:
   - With a valid gateway configured, load the workspace or call `GET /api/bootstrap`.
   - Confirm the returned agent list matches the user-scoped agents expected for the workspace.
   Pass criteria:
   - The response shape is valid.
   - `found: true` is returned when the gateway exists.
   - The visible/returned agent list stays aligned with the current user's scoped workspace data.
EOF
}

print_validation_guards() {
  cat <<'EOF'

6. Validation Guards
   Scope:
   - Verify invalid IDs and unauthorized access still fail safely.
   Steps:
   - Submit an invalid `agentId` such as `../bad-agent` to the create or delete route in a test request.
   - If auth handling changed, try the same route without a valid session in a safe local test.
   Pass criteria:
   - Invalid IDs return `400 Invalid agentId`.
   - Missing auth returns `401 Unauthorized`.
   - Non-owned workspace access returns `403 Forbidden` when applicable.
EOF
}

detect_scenarios

echo "Agent Bootstrap Plan"
echo "Repository: $ROOT_DIR"
echo

if ((${#FILES[@]} > 0)); then
  echo "Changed files:"
  printf '  - %s\n' "${FILES[@]}"
else
  echo "Changed files: none detected"
fi

echo
echo "Baseline first:"
if ((${#FILES[@]} > 0)); then
  printf '  bash skills/code-change-verification/scripts/run-checks.sh'
  printf ' %q' "${FILES[@]}"
  printf '\n'
else
  echo "  bash skills/code-change-verification/scripts/run-checks.sh"
fi

echo
echo "Preconditions:"
echo "  - Logged-in user who owns the target workspace"
echo '  - Safe local `.openclaw` environment'
echo "  - Disposable agent name and ID for create/delete checks"
echo "  - Backup or awareness that local config files will change during the test"

if ((${#SCENARIOS[@]} == 0)); then
  echo
  echo "No targeted bootstrap scenarios detected from the current file set."
  echo "Pass --full to print the full bootstrap checklist anyway."
  exit 0
fi

echo
echo "Recommended scenarios:"
for scenario in "${ORDERED_SCENARIOS[@]}"; do
  if printf '%s\n' "${SCENARIOS[@]}" | grep -qx "$scenario"; then
    printf '  - %s\n' "$scenario"
  fi
done

for scenario in "${ORDERED_SCENARIOS[@]}"; do
  if ! printf '%s\n' "${SCENARIOS[@]}" | grep -qx "$scenario"; then
    continue
  fi

  case "$scenario" in
    create-agent)
      print_create_agent
      ;;
    workspace-files)
      print_workspace_files
      ;;
    openclaw-config)
      print_openclaw_config
      ;;
    delete-cleanup)
      print_delete_cleanup
      ;;
    bootstrap-discovery)
      print_bootstrap_discovery
      ;;
    validation-guards)
      print_validation_guards
      ;;
  esac
done

echo
echo "Reporting template:"
echo "  - Scenario"
echo "  - Disposable agent ID"
echo "  - Result: pass/fail"
echo "  - Evidence: file/API/UI observation"
echo "  - Cleanup status"
