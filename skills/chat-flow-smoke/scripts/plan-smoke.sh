#!/usr/bin/env bash

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

FULL_PLAN=0
declare -a FILES=()
declare -a SCENARIOS=()
declare -a ORDERED_SCENARIOS=(
  "gateway-connectivity"
  "dm-streaming"
  "team-sequencing"
  "abort-streaming"
)

usage() {
  cat <<'EOF'
Usage:
  bash skills/chat-flow-smoke/scripts/plan-smoke.sh [--full] [files...]

Options:
  --full     Print the full smoke checklist even if only some scenarios match.
  -h, --help Show this help message.

Behavior:
  - If file paths are provided, classify those paths.
  - If no file paths are provided, inspect the current git working tree.
  - Print the recommended smoke scenarios, prompts, and pass criteria.
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
    add_scenario "gateway-connectivity"
    add_scenario "dm-streaming"
    add_scenario "team-sequencing"
    add_scenario "abort-streaming"
    return 0
  fi

  for file in "${FILES[@]:-}"; do
    case "$file" in
      src/lib/gateway.ts|src/lib/gateway-config.ts|src/app/api/detect-gateway/route.ts|src/app/api/chat/route.ts|src/app/api/bootstrap/route.ts)
        add_scenario "gateway-connectivity"
        ;;
    esac

    case "$file" in
      src/lib/store.tsx|src/lib/gateway.ts|src/components/chat-area.tsx|src/app/api/chat/route.ts|src/types/index.ts)
        add_scenario "dm-streaming"
        ;;
    esac

    case "$file" in
      src/lib/store.tsx|src/components/chat-area.tsx|src/types/index.ts)
        add_scenario "team-sequencing"
        ;;
    esac

    case "$file" in
      src/lib/store.tsx|src/lib/gateway.ts|src/components/chat-area.tsx)
        add_scenario "abort-streaming"
        ;;
    esac
  done
}

print_gateway_connectivity() {
  cat <<'EOF'

1. Gateway Connectivity
   Scope:
   - Verify the workspace still reaches a configured gateway and chat entry is usable.
   Steps:
   - Start ChatClaw and sign in.
   - Open a workspace with at least one existing agent.
   - Open the agent DM view and confirm the composer is usable instead of remaining in a gateway-unavailable state.
   - Send a short prompt such as: `Reply with the word CONNECTED.`
   Pass criteria:
   - The message sends without an immediate client-side block.
   - A response arrives through the normal chat path.
   - No obvious gateway/auth error is rendered in the chat transcript.
EOF
}

print_dm_streaming() {
  cat <<'EOF'

2. Single-Agent DM Streaming
   Scope:
   - Verify user message insertion, streaming state, and final persistence for a direct chat.
   Suggested prompt:
   - `Reply with 8 short numbered bullets about release readiness.`
   Steps:
   - Open a direct chat with one agent.
   - Send the prompt.
   - Watch the in-flight response until it completes.
   Pass criteria:
   - The user message appears immediately.
   - An in-flight assistant row appears while the response is streaming.
   - The final assistant response remains in message history after streaming ends.
   - The temporary streaming row clears cleanly and does not leave a duplicate final message.
EOF
}

print_team_sequencing() {
  cat <<'EOF'

3. Team Sequencing
   Scope:
   - Verify team chats still run agents one-by-one and carry current-round context forward.
   Suggested prompt:
   - `First agent: propose one release step and end with KEYWORD-ALPHA. Second agent: quote KEYWORD-ALPHA and critique that step in one sentence.`
   Steps:
   - Open a team chat with at least two agents.
   - Send the prompt and wait for both replies.
   Pass criteria:
   - Team replies arrive sequentially rather than all at once.
   - Each assistant reply is attributed to the expected agent.
   - The later reply explicitly reuses `KEYWORD-ALPHA` or otherwise proves it saw the earlier reply from the same round.
EOF
}

print_abort_streaming() {
  cat <<'EOF'

4. Abort Streaming
   Scope:
   - Verify the stop button, abort request, and partial-content handling.
   Suggested prompt:
   - `Write 40 one-line ideas for improving a product landing page.`
   Steps:
   - Send the prompt in a DM or team chat.
   - Wait for partial output to appear.
   - Click the stop button while streaming is active.
   Pass criteria:
   - The stop control is visible during streaming and returns to the normal send control afterward.
   - If partial text arrived before abort, that partial assistant content remains visible in history.
   - A follow-up message can be sent normally after the abort.
EOF
}

detect_scenarios

echo "Chat Flow Smoke Plan"
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
echo "  - Logged-in ChatClaw session"
echo "  - Reachable gateway configuration"
echo "  - At least one agent for DM checks"
echo "  - At least one two-agent team when team sequencing is in scope"

if ((${#SCENARIOS[@]} == 0)); then
  echo
  echo "No targeted chat-flow scenarios detected from the current file set."
  echo "Pass --full to print the full chat smoke checklist anyway."
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
    gateway-connectivity)
      print_gateway_connectivity
      ;;
    dm-streaming)
      print_dm_streaming
      ;;
    team-sequencing)
      print_team_sequencing
      ;;
    abort-streaming)
      print_abort_streaming
      ;;
  esac
done

echo
echo "Reporting template:"
echo "  - Scenario"
echo "  - Prompt used"
echo "  - Result: pass/fail"
echo "  - Evidence: what appeared in the UI"
echo "  - Residual risk"
