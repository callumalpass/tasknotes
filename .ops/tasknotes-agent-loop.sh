#!/usr/bin/env bash

set -euo pipefail

REPO_DIR="/home/calluma/projects/tasknotes"
OPS_DIR="$REPO_DIR/.ops"
TASKS_DIR="$OPS_DIR/tasks"
LOG_DIR="$OPS_DIR/logs/agent-loop"
MODE="review"
ITERATIONS=1
DELAY_SECONDS=0
MODEL=""
BRANCH="auto-improvement"
SWITCH_BRANCH=0
DRY_RUN=0
FOCUS_FILE=""

FOCUS_AREAS=(
  "tasks view with large datasets, grouping, counts, and virtual scrolling"
  "kanban drag and drop, status transitions, card rendering, and column counts"
  "calendar recurring tasks, ICS overlays, drag/drop, date edits, and stale rendering"
  "agenda and tasks view consistency for the same tasks across filters and grouping"
  "quick actions, context menus, and right-click interactions on task cards"
  "task creation, convert-to-task flows, and create-or-open-task behavior"
  "date editing, reminders, recurrence, and overdue/scheduled metadata rendering"
  "pomodoro and time-tracking flows, timer state, and task linkage"
  "keyboard-only navigation, focus handling, and accessibility issues"
  "large vault or pathological data behavior, including slow renders and broken UI states"
)

usage() {
  cat <<'EOF'
Usage: tasknotes-agent-loop.sh [options]

Options:
  --mode review|improve   Run bug-finding review or improvement pass. Default: review
  --iterations N          Number of Codex runs. Default: 1
  --delay SECONDS         Sleep between runs. Default: 0
  --model MODEL           Optional model to pass to Codex
  --branch NAME           Improvement branch name. Default: auto-improvement
  --switch-branch         In improve mode, switch/create the branch before running
  --focus-file PATH       Optional newline-delimited list of focus areas to rotate through
  --dry-run               Print prompts and commands without executing Codex
  -h, --help              Show this help

Examples:
  .ops/tasknotes-agent-loop.sh --mode review --iterations 5
  .ops/tasknotes-agent-loop.sh --mode improve --iterations 3 --switch-branch
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --iterations)
      ITERATIONS="${2:-}"
      shift 2
      ;;
    --delay)
      DELAY_SECONDS="${2:-}"
      shift 2
      ;;
    --model)
      MODEL="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --switch-branch)
      SWITCH_BRANCH=1
      shift
      ;;
    --focus-file)
      FOCUS_FILE="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "review" && "$MODE" != "improve" ]]; then
  echo "Invalid mode: $MODE" >&2
  exit 1
fi

if ! [[ "$ITERATIONS" =~ ^[0-9]+$ ]] || [[ "$ITERATIONS" -lt 1 ]]; then
  echo "--iterations must be a positive integer" >&2
  exit 1
fi

if ! [[ "$DELAY_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "--delay must be a non-negative integer" >&2
  exit 1
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "Expected git repo at $REPO_DIR" >&2
  exit 1
fi

mkdir -p "$TASKS_DIR" "$LOG_DIR"

load_focus_areas() {
  local raw line
  if [[ -n "$FOCUS_FILE" ]]; then
    if [[ ! -f "$FOCUS_FILE" ]]; then
      echo "Focus file not found: $FOCUS_FILE" >&2
      exit 1
    fi
    mapfile -t raw < "$FOCUS_FILE"
    FOCUS_AREAS=()
    for line in "${raw[@]}"; do
      [[ -z "${line// }" ]] && continue
      [[ "${line:0:1}" == "#" ]] && continue
      FOCUS_AREAS+=("$line")
    done
    if [[ "${#FOCUS_AREAS[@]}" -eq 0 ]]; then
      echo "No usable focus areas found in $FOCUS_FILE" >&2
      exit 1
    fi
  fi
}

current_branch() {
  git -C "$REPO_DIR" branch --show-current
}

ensure_improvement_branch() {
  local branch
  branch="$(current_branch)"

  if [[ "$SWITCH_BRANCH" -eq 1 ]]; then
    if [[ -n "$(git -C "$REPO_DIR" status --short)" ]]; then
      echo "Refusing to switch branches with a dirty worktree. Commit/stash first." >&2
      exit 1
    fi
    if git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then
      git -C "$REPO_DIR" switch "$BRANCH"
    else
      git -C "$REPO_DIR" switch -c "$BRANCH"
    fi
    branch="$(current_branch)"
  fi

  if [[ "$branch" == "main" ]]; then
    echo "Improve mode must not run on main. Switch to $BRANCH or pass --switch-branch." >&2
    exit 1
  fi
}

build_review_prompt() {
  local focus="$1"
  cat <<EOF
You are reviewing the TaskNotes Obsidian plugin for reproducible bugs, regressions, UX failures, performance/pathological issues, and code-level weaknesses that are likely to cause real problems.

Context:
- Repo: $REPO_DIR
- Use Obsidian CLI against: vault=test
- Vault path: /home/calluma/testvault/test
- Output task directory: $TASKS_DIR
- Existing ops registry: $OPS_DIR
- Plugin id: tasknotes

Primary goal for this run:
- Review code related to this focus area: $focus
- Use the Obsidian CLI to exercise the live plugin UI in vault=test
- Prefer findings supported by both code inspection and live reproduction

Rules:
1. Inspect existing files in $TASKS_DIR first to avoid duplicates.
2. Do not modify plugin code in this phase.
3. Do not fix issues in this phase.
4. Do not create weak/speculative tasks.
5. If code review suggests a likely bug, try to confirm it in the test vault before filing.
6. If live testing finds a bug, inspect code enough to suggest likely scope and relevant files.
7. Spend at most 15 minutes or 25 meaningful CLI interactions.
8. Optimize for 1-2 high-confidence findings, not broad coverage.

Useful Obsidian CLI capabilities:
- obsidian plugins filter=community versions format=json vault=test
- obsidian plugin id=tasknotes vault=test
- obsidian commands vault=test
- obsidian command id=<command-id> vault=test
- obsidian dev:debug on
- obsidian dev:errors
- obsidian dev:console level=error limit=50
- obsidian dev:dom selector='<selector>' all
- obsidian dev:screenshot path=<path>

Valid findings include:
- reproducible bug
- clear broken behavior
- obvious UX failure
- performance/pathological behavior
- accessibility or keyboard issue
- stale state, wrong counts, wrong navigation, broken edit flow, rendering glitch, drag/drop issue, or runtime error
- code smells likely to cause real user-facing breakage, especially if confirmed in UI

For each solid issue:
- reproduce it at least twice if feasible
- collect evidence using CLI output, DOM inspection, screenshots, and console/errors when relevant
- write one markdown task file in $TASKS_DIR

Task file requirements:
- One file per issue
- Use a concise slugged filename
- Include frontmatter with at least:
  - type: task
  - title:
  - status: open
  - priority:
  - area:
  - discovered_by: codex
  - discovered_at:
  - reproduction_confidence:
- In the body include:
  - Summary
  - Why this is a problem
  - Exact reproduction steps
  - Expected behavior
  - Actual behavior
  - Evidence
  - Relevant code paths
  - Notes on likely scope or hypotheses if useful
- Include exact Obsidian CLI commands used
- Include screenshot file paths if captured

At the end:
- Print a short summary of what you reviewed and tested
- List any new task files created
- If no issue was filed, say so explicitly
EOF
}

build_improve_prompt() {
  local focus="$1"
  local branch
  branch="$(current_branch)"
  cat <<EOF
You are implementing one small, reviewable improvement for TaskNotes.

Context:
- Repo: $REPO_DIR
- Current git branch must stay off main. Current branch: $branch
- Preferred long-lived branch: $BRANCH
- Ops task directory: $TASKS_DIR
- Obsidian test vault: /home/calluma/testvault/test using vault=test
- Focus area for this run: $focus

Your job:
1. Inspect open tasks in $TASKS_DIR and choose one high-confidence task that matches or is close to the focus area.
2. Do not start a new exploratory bug hunt unless needed to verify the chosen task.
3. Implement a minimal fix or targeted improvement in the TaskNotes codebase.
4. Run relevant verification.
5. Update the chosen task markdown file with:
   - what changed
   - files touched
   - how it was verified
   - screenshots or CLI evidence if relevant
   - remaining risks or follow-up work

Rules:
- Do not work on more than one task in this run.
- Keep the change small and reviewable.
- Prefer reproducing the issue before and after the fix when feasible.
- Use the Obsidian CLI with vault=test for live verification when relevant.
- You may edit code in this phase.
- You may add or adjust tests if useful.
- Do not switch branches.
- Do not rewrite unrelated files.

At the end:
- Print the chosen task file
- Summarize the code changes
- Summarize verification performed
- Report whether the task file was updated
EOF
}

run_codex() {
  local prompt_file="$1"
  local last_msg_file="$2"
  local cmd=(
    codex exec
    --dangerously-bypass-approvals-and-sandbox
    -C "$REPO_DIR"
    --add-dir "$OPS_DIR"
    --output-last-message "$last_msg_file"
  )

  if [[ -n "$MODEL" ]]; then
    cmd+=(--model "$MODEL")
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf 'DRY RUN COMMAND:'
    printf ' %q' "${cmd[@]}"
    printf ' - < %q\n' "$prompt_file"
    echo "----- PROMPT BEGIN -----"
    cat "$prompt_file"
    echo "----- PROMPT END -----"
    return 0
  fi

  "${cmd[@]}" - < "$prompt_file"
}

load_focus_areas

if [[ "$MODE" == "improve" ]]; then
  ensure_improvement_branch
fi

for ((i = 0; i < ITERATIONS; i++)); do
  focus="${FOCUS_AREAS[$((i % ${#FOCUS_AREAS[@]}))]}"
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  run_dir="$LOG_DIR/${MODE}-${ts}-$(printf '%02d' "$((i + 1))")"
  mkdir -p "$run_dir"

  prompt_file="$run_dir/prompt.txt"
  last_msg_file="$run_dir/final-message.txt"
  transcript_file="$run_dir/stdout.log"

  if [[ "$MODE" == "review" ]]; then
    build_review_prompt "$focus" > "$prompt_file"
  else
    build_improve_prompt "$focus" > "$prompt_file"
  fi

  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting $MODE run $((i + 1))/$ITERATIONS"
  echo "Focus: $focus"
  echo "Logs: $run_dir"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    run_codex "$prompt_file" "$last_msg_file"
  else
    run_codex "$prompt_file" "$last_msg_file" | tee "$transcript_file"
  fi

  if [[ "$DELAY_SECONDS" -gt 0 && $((i + 1)) -lt "$ITERATIONS" ]]; then
    sleep "$DELAY_SECONDS"
  fi
done
