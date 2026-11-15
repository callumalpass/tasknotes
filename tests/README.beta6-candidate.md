# 5.0.0-beta.6 candidate qualification

Prepared on `integration/v5-beta6-candidate`; no tag, push, GitHub mutation or publication is part of this preparation.

## Source and release process

- The published v5 line is `origin/agent/tasknotes-v5-documentation`: beta.5 is `f4cf035b`, with beta.4 at `cf489ec0`. Beta.3 was cut at `aeead023` after merging main, followed by the documentation-only `ef6f3a8f` retained in its historical release worktree. That worktree is not the current release head. GitHub's beta.5 `targetCommitish: main` is default release metadata; its annotated source tag resolves to the v5 commit, not main.
- `63462e45` already descended from beta.5 and merged main through `64e4f771`. Merge `8566b7ec` brings in all eight remaining main commits through `273a0304` (4.14.0).
- `484499f0`, the configured-sort-direction fix relevant to #2415, is an ancestor. It did not need cherry-picking.
- Earlier betas update package/lock/manifest versions, `versions.json`, release notes and their index. The tag-triggered workflow builds attested assets and creates a **draft prerelease**. It was inspected, not triggered.
- Beta.6 retains Obsidian >=1.13.1, `@tasknotes/model` 0.3.0-rc.16, mdbase interop and v5 native settings. Main's MCP SDK/security updates are retained.

## Merge resolution and runtime adaptation

Conflicts were in release metadata/notes, eight locale files, `src/main.ts`, and Google Calendar tests. Preserve both stable and beta history; retain v5 dependencies and minimum Obsidian; include main's translated reminder strings; retain both display-name and connection-generation tests. The recurring entry point uses the new Undo receipt/notice rather than the old notice and still returns the recurring parent for occurrence-backed actions.

Review found that raw mapped YAML omitted status while TaskManager supplied its default. This made immediate Undo falsely conflict. Reproduced before fixing; receipt comparison and restored cache publication now use the same task assembly/defaults as TaskManager. Regression tests cover real FieldMapper/TaskManager behavior, custom status properties, virtual/materialized actions, and emitted cache state. A second independent source review found no remaining objections.

Notification startup remains after canonical mdbase initialization and TaskManager listeners. There is no separate mdbase-engine task hydration barrier: these runtime task reads use Obsidian's metadata cache.

## Automated checks

All finite suites/builds ran through **rpnpm**. This is an npm/package-lock project, so an uncommitted pnpm bridge launched a temporary driver that ran `npm ci --ignore-scripts` and the normal repository commands remotely. The bridge/driver are not release changes. No lint, type, test or security checks were weakened.

- Full strict lint: TypeScript, review-types, CSS, architecture — passed.
- Typecheck — passed.
- Full Jest — **784 suites / 5,200 tests passed**; 70 suites / 1,012 tests skipped and 4 todo remain explicit.
- Translation verification — all eight non-English locales **2,480/2,480 current**, no stale strings. Key-usage check passed.
- Node script/dependency regressions — **25 passed** (including patched braces consumers, NYC YAML and MCP/AJV compatibility).
- Spec conformance — **4,981 passed, 1 skipped**.
- Documentation source/index/privacy, production docs build and built-site checks — passed. Git-aware source checks also ran locally because rpnpm deliberately omits `.git`.
- Production plugin build and bundle budget — passed: `main.js` **4,721,507 bytes**, limit strictly below 5,000,000.
- Frozen npm install and production dependency audit — no reported vulnerabilities.

The first remote run found only an unset `TMPDIR` assumption in seven existing filesystem tests. The full successful rerun supplied the worker's temporary directory. Missing worker `rg` and a login-shell PATH issue in the temporary driver were also corrected before rerunning all checks. They were not product failures.

## Recorded desk acceptance

2026-10-23, Australia/Melbourne time; sandbox `gcp/tn-beta6`, Obsidian **1.14.4**, vault verified as `/config/vaults/tasknotes-e2e-vault`. No normal/local vault or local e2e instance was used. Session: https://desk-gcp.callumalpass.net/tn-beta6/ (recording/summary retained after disposal).

- **22:49–22:52, #2415:** actual `scheduled ASC` groups, exactly two tasks per date, alpha ranks `tniririririq` and `tniririririr`, manual order first. Eight native OS mouse drags covered above/below, ASC/DESC, and two dates. YAML changed to the correct side of the neighbour (`q`/`s` around `r`). Both views retained order after reopen and full process restart.
- **23:03–23:05, #2415 final build/canonical path:** with canonical mdbase enabled, repeated non-original DESC-above and ASC-below moves. After reopening and a full normal process restart, Alpha's persisted `tniriririris` remained above Beta's `tniririririr` in DESC and below it in ASC.
- **22:43–22:44, #2412 before fix:** an omitted-status parent completed but immediate Undo falsely conflicted. An explicit-status control succeeded.
- **22:58–23:01, #2412 after fix:** fresh omitted-status tasks undo correctly, retain absent YAML status and publish runtime `open`. Annual notices show 2035/2036. Timed materialized actions return the parent, advance due/scheduled together, and Undo restores both parent/occurrence, clock, due offset and checked parent checklist without deleting occurrence notes.
- **23:00–23:02, canonical mdbase:** enabled v0.3 metadata, verified `_types/task.md` and its contract binding, then restarted with custom identification `kind=action`, `workflow_state`, `plan_date`, `deadline` and `alerts`. Repeated omitted-status and timed materialized Undo successfully; restored state survived restart.
- **22:53–22:56, #2413:** offline relative reminder plus 4,000 offline indexing-backlog notes delivered the missed reminder with due time on startup. Second restart did not replay. Four-task rollup kept the latest reminder per task, excluded completed/archived/>24h/future controls, opened the clicked task and dismissed the summary. Another restart did not replay.
- **23:00, #2413 canonical custom mappings:** after normal close and offline writes, startup delivered only the eligible `kind=action` task using `deadline`/`alerts`; completed/archive controls did not notify. A second full restart did not replay.

Test-setup notes: a single-jump desk drag did not produce a native drop; paced OS mouse gestures did. Abruptly killing Chromium immediately after backdating a synthetic local-storage cursor could discard that unflushed cursor; normal window close preserved it. An in-place fixture reset without waiting for new metadata was safely rejected by Undo; the fresh-fixture and canonical cases passed. Obsidian reported no console errors; a lazy dependency-index warning and the sandbox's unavailable OS secret store were unrelated to these checks.

## Scope and remaining risks

- Linux desktop verification is not a physical Windows, Android or iOS run. Beta.5's documented concurrent mobile metadata-publication limitation remains; keep a full vault backup and finish syncing before upgrade.
- No real Google/Microsoft account, external notification delivery, App/Connect daemon, Sync race or publication workflow was exercised. Google display names are covered by the merged tests; no account was connected.
- New #2415 and omitted-status native e2e regressions are committed; live acceptance used desk rather than executing the repository's local launch harness.
- Remote build outputs lack Git-derived historical release dates because `.git` is intentionally not synced. They are test artifacts, not pre-approved publication assets. Any future tag workflow must rebuild, verify provenance/assets/notes and preserve **prerelease**, not stable/latest, classification.
