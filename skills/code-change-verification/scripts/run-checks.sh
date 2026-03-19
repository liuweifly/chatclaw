#!/usr/bin/env bash

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=0
FORCE_RUN=0
declare -a FILES=()
declare -a CATEGORIES=()
declare -a PASSED_STEPS=()
declare -a FAILED_STEPS=()
declare -a SKIPPED_STEPS=()

usage() {
  cat <<'EOF'
Usage:
  bash skills/code-change-verification/scripts/run-checks.sh [--force] [--dry-run] [files...]

Options:
  --force    Run the default verification stack even if no trigger paths match.
  --dry-run  Print the planned commands without executing them.
  -h, --help Show this help message.

Behavior:
  - If file paths are provided, classify those paths.
  - If no file paths are provided, inspect the current git working tree.
  - Run pnpm lint and pnpm build for matching ChatClaw app/runtime changes.
  - Run pnpm verify:i18n when i18n-related files changed.
EOF
}

while (($# > 0)); do
  case "$1" in
    --force)
      FORCE_RUN=1
      ;;
    --dry-run)
      DRY_RUN=1
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

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but was not found in PATH." >&2
  exit 1
fi

add_category() {
  local category="$1"
  local existing

  for existing in "${CATEGORIES[@]:-}"; do
    if [[ "$existing" == "$category" ]]; then
      return 0
    fi
  done

  CATEGORIES+=("$category")
}

detect_categories() {
  local file

  for file in "${FILES[@]:-}"; do
    case "$file" in
      src/app/api/*|src/app/api/**/*)
        add_category "api-routes"
        add_category "runtime"
        ;;
    esac

    case "$file" in
      src/lib/gateway.ts|src/lib/gateway-config.ts|src/app/api/chat/route.ts|src/app/api/detect-gateway/route.ts|src/app/api/gateway/*|src/app/api/gateway/**/*)
        add_category "gateway"
        add_category "runtime"
        ;;
    esac

    case "$file" in
      src/i18n/*|src/i18n/**/*|scripts/verify-i18n.mjs)
        add_category "i18n"
        ;;
    esac

    case "$file" in
      src/app/api/agents/*|src/app/api/agents/**/*|src/app/api/bootstrap/route.ts|src/lib/agent-security.ts)
        add_category "agent-bootstrap"
        add_category "runtime"
        ;;
    esac

    case "$file" in
      src/*|src/**/*|middleware.ts|next.config.ts|package.json)
        add_category "runtime"
        ;;
    esac
  done
}

run_step() {
  local label="$1"
  shift

  echo
  echo "==> $label"

  if ((DRY_RUN == 1)); then
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
    PASSED_STEPS+=("$label (dry-run)")
    return 0
  fi

  if "$@"; then
    PASSED_STEPS+=("$label")
    return 0
  fi

  FAILED_STEPS+=("$label")
  return 1
}

detect_categories

echo "Code Change Verification"
echo "Repository: $ROOT_DIR"
echo

if ((${#FILES[@]} > 0)); then
  echo "Changed files:"
  printf '  - %s\n' "${FILES[@]}"
else
  echo "Changed files: none detected"
fi

if ((${#CATEGORIES[@]} > 0)); then
  echo
  echo "Detected categories:"
  printf '  - %s\n' "${CATEGORIES[@]}"
else
  echo
  echo "Detected categories: none"
fi

if ((${#CATEGORIES[@]} == 0)) && ((FORCE_RUN == 0)); then
  echo
  echo "No matching runtime/API/gateway/i18n/agent-bootstrap changes detected."
  echo "Nothing to run. Pass --force to execute the default stack anyway."
  exit 0
fi

overall_status=0

if ! run_step "pnpm lint" pnpm lint; then
  overall_status=1
fi

if ! run_step "pnpm build" pnpm build; then
  overall_status=1
fi

if printf '%s\n' "${CATEGORIES[@]:-}" | grep -qx 'i18n'; then
  if ! run_step "pnpm verify:i18n" pnpm verify:i18n; then
    overall_status=1
  fi
else
  SKIPPED_STEPS+=("pnpm verify:i18n (no i18n changes detected)")
fi

echo
echo "Summary"
if ((${#PASSED_STEPS[@]} > 0)); then
  echo "Passed:"
  printf '  - %s\n' "${PASSED_STEPS[@]}"
fi

if ((${#FAILED_STEPS[@]} > 0)); then
  echo "Failed:"
  printf '  - %s\n' "${FAILED_STEPS[@]}"
fi

if ((${#SKIPPED_STEPS[@]} > 0)); then
  echo "Skipped:"
  printf '  - %s\n' "${SKIPPED_STEPS[@]}"
fi

exit "$overall_status"
