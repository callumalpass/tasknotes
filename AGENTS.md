# TaskNotes – Codex Operating Rules

## Language

- **Chat**: German.
- **Code & docs**: English only.

## Workspace Layout

- `./upstream` → Upstream baseline mirror (**read-only**).
- `./main` → Fork main worktree (branch `main`); merges only after explicit approval.
- `./intg` → Integration test worktree (merge multiple branches for combined testing; no pushes).
- `./feat/drft/{feat, fix, ...}-<feature>` → Draft worktrees (active, not yet merged to `main`).
- `./feat/preq/{feat, fix, ...}-<feature>` → PR worktrees (published PRs).
- `./_archive` → Archived worktrees/data (ignored for active work).

## Engineering Expectations

- Act as an expert Obsidian/TypeScript/HTML/CSS engineer and a seasoned software architect.
- Prefer minimal, targeted changes; avoid refactors unless requested.
- Deliver professional-grade code that is robust, maintainable, clear, correct, and performant; include tests whenever feasible.
- Optimize for robustness, clarity, maintainability, and compatibility with `./main`.
- Ask clarifying questions before risky changes.

## Principles & Guardrails

### Architecture Guardrails (from upstream/Tasknotes-Development-Guidelines.md)

- Native-first data: Obsidian `metadataCache` is the source of truth; avoid duplicating data.
- Minimal cache: use it for event coordination plus essential indexes only.
- Unidirectional flow: UI → Service → File System → Native Cache → Events → UI.
- UI updates: prefer `DOMReconciler` and coordinated refreshes over ad-hoc DOM manipulation.

### Date & Time Rules (UTC Anchor)

- Internal logic (sorting/filtering/comparisons): always use `parseDateToUTC`.
- UI display/input: always use `parseDateToLocal`.
- Never use `new Date(dateString)` directly.

### Quality Attributes (Mandatory)

Robustness, modularity, maintainability, naming consistency, standards compliance, scalability, performance/responsiveness, and resource efficiency.

## Commit Rules (Strict)

- Use Conventional Commits with **lowercase** prefix (`fix:`, `feat:`, `docs:`, `chore:`, ...).
- Always **propose a commit message first** and wait for explicit approval.
- Do **not** rewrite history of branches with open PRs unless explicitly instructed.

## Workflow (Strict)

**Mandatory** before creating **any** new branch/worktree (applies to all `./feat/drft/*`, `./feat/preq/*`, and `./main`): Run the full **Status-Check (sync/clean)** and confirm a clean project state.

**Mandatory** if you merge `upstream/main` into any branch, run `npm run i18n:sync`. If `i18n.manifest.json` or `i18n.state.json` changed, commit them with `chore: sync i18n manifest`. This prevents CI failures in `Check i18n manifest is up-to-date`.

### 1) Where to Work

- Default: work **only** in `./feat/drft/...`.
- Exception: fixing an **already published PR** → work directly in the matching `./feat/preq/...`.
- Never develop in `./main`, `./upstream`, or `./intg`.

### 2) Checkpoint Tags (Mandatory)

- Before any risky change, create a checkpoint tag.
- Pattern: `checkpoint-review-<branch>-<finding>-YYYY-MM-DD`.
- Remove the tag **only after approval**.

### 3) Feature Branch Creation

- Feature branches are **always** based on `upstream/main` (never `main`).

```
git -C ./main fetch upstream
git -C ./main branch {feat, fix, ...}-<feature> upstream/main
git -C ./main worktree add ./feat/drft/{feat, fix, ...}-<feature> {feat, fix, ...}-<feature>
```

### 3a) Integration Strategy (intg)

- Merge candidate branches into `./intg` for **combined testing** before any merge to `main`.
- `./intg` is for local verification only (no pushes).
- Do **not** keep `PR.md` in `./intg` (integration notes belong in `CHANGELOG.md` after merge to `main`).

### 4) Publishing a PR

- When ready: move `./feat/drft/...` → `./feat/preq/...`:

```
git -C ./main worktree move ./feat/drft/{feat, fix, ...}-<feature> ./feat/preq/{feat, fix, ...}-<feature>
```

- Suggest to open a PR from that feature branch to upstream.
- PRs may be opened **after** merging into `main`.

### 5) PR Documentation (Mandatory)

- Each feature branch **must** contain `PR.md` at repo root.
- Structure (exact):

```
# <branch-name>

## <Short title>

<1–3 sentence summary>

Examples (illustrative):

- Example 1
- Example 2

## Changelog

- Bullet list of changes

## Tests

- List of tests run (or "Not run")
```

### 6) Integration to `main`

- Only when explicitly requested.
- Only after the branch has been verified in `./intg`.
- Always **merge** (no cherry-picks) and **always** with `--no-ff`.
- Merge commit message format:
  `Merge branch '<feature-branch>' of github.com:normenmueller/tasknotes into main`

```
git -C ./main fetch origin <feature-branch>
git -C ./main merge --no-ff origin/<feature-branch>
```

### 7) Changelog & Roadmap

- `./main/CHANGELOG.md` is the **single source of truth** for:
  - Integration summaries
  - Roadmap/Findings tracking
-- After merging a feature into `main`:
  - Copy summary from `PR.md` into `CHANGELOG.md`
  - Remove `PR.md` from `main` (avoid conflicts)
  - Order entries **newest first**
- Commit with `chore: update integration changelog (<feature>)`

### 8) Push Policy

- **Never push** any branch until explicitly approved.
- Before any push, ensure the branch **compiles** and the **relevant tests pass** (only the tests affected by the change set).
- For open PR branches, no history rewrites unless explicitly requested.

### 9) Testing (Required when tests are added)

- If a change adds or modifies tests, **run the relevant tests**.
- **User runs `npm install`**. Do not run it unless explicitly requested.
- **Fresh branch/worktree rule**: before running any tests in a newly created worktree, verify `node_modules/` exists. If it does not, ask the user to run `npm install` and wait for confirmation before executing tests.
- For UI‑only changes where automated tests are not applicable:
  - Perform manual verification.
  - Record “Not run (manual testing only)” in `PR.md`.
- Prefer **narrow test scope** (single test file) to avoid unrelated upstream noise.
- Ignore unrelated test noise/failures that are not caused by the current change set.
- If i18n strings/resources change:
  - Run `npm run i18n:sync` and commit manifest/state updates.
  - Run `npm run test:unit -- --runTestsByPath tests/unit/services/i18nService.test.ts`.
- **CI baseline (mandatory)**: run the same sequence as `.github/workflows/test.yml` and treat it as the baseline for all branches:
  - `npm run i18n:sync`
  - `npm run lint`
  - `node generate-release-notes-import.mjs`
  - `npm run typecheck`
  - `npm run test:ci -- --verbose`
  - `npm run test:integration`
  - `npm run test:performance`
  - `npm run build` (requires OAuth env vars)
  - `npm run test:build`
- **Failure rule**: if a CI step fails in `./upstream`, the same failure is acceptable in branches. If it passes in `./upstream`, it must pass in all branches.
- **OAuth env vars**: `npm run build` / `npm run test:build` must still be run. If they fail due to missing `GOOGLE_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_ID`, that failure is acceptable, but must be documented in `PR.md` (and in `CHANGELOG.md` for `main`).

### 9a) Manual Regression Checks (Targeted)

- If changes touch overdue logic, agenda, or settings:
  - Follow `test-overdue-setting.md` step-by-step and record outcome.

### 10) Integration Test Pass (after merge into `main`)

- After merging a feature/fix into `main`, run the **full CI baseline** (see "CI baseline (mandatory)").
- Failures are acceptable **only** if they also fail in `./upstream`. If they pass in `./upstream`, they must pass in `main`.
- You may re-run the same baseline suite in `./upstream` to compare (optional but recommended).
- If a branch had “Not run (manual testing only)”, repeat the manual checks in `main` and note that in `CHANGELOG.md` if needed.

## Status-Check (sync/clean)

If the user asks to check the project status (sync/clean), propose the following full health check and run it only after approval:

1) **List all worktrees**
```
git -C ./main worktree list
```

2) **Check clean/dirty state per worktree**
Run `git status -sb` for:
- `./main`
- `./upstream`
- every `./feat/preq/*` worktree
- every `./feat/drft/*` worktree
- **Ignore** anything under `./_archive` (not part of active work).

3) **Sync checks**
- `./upstream` must be **in sync** with `upstream/main`.
- `./main` must be **not behind** `upstream/main`:
```
git -C ./main rev-list --left-right --count upstream/main...HEAD
```
- `./feat/preq/*` should be in sync with their `origin/<branch>` unless explicitly stated otherwise.
- `./feat/drft/*` should be clean and may be ahead of `upstream/main` (report ahead count).
- Verify **no stray checkpoint tags** remain:
  - List `checkpoint-*` tags.
  - Only keep tags that are explicitly still needed; otherwise report them as cleanup items.

4) **Report**
Return a concise summary:
- clean/dirty per worktree
- ahead/behind vs remote
- any outliers that need action
- leftover checkpoint tags (if any)

## Review-Check (Strict)

Before continuing implementation work, run a focused peer review across active worktrees.

**Scope**
- All branches in `./feat/drft/*`
- All branches in `./feat/preq/*`
- `./main`

**Per-branch goals**
- Assess only our changes (not upstream) for professionalism, robustness, maintainability, clarity, correctness, and performance.
- Verify adherence to the code/test guidance in `Tasknotes-Development-Guidelines.md`.
- Do **not** review unrelated upstream code; focus strictly on our diff.
- Explicitly evaluate against the **Quality Attributes** listed above; guardrail violations are **High severity**.

**Output**
- Findings grouped by severity (High/Medium/Low) with file references.
- Clear recommendation per branch: **OK** or **Changes Required**.
