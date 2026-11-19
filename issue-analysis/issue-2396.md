# #2396: moved virtual recurring occurrence appears twice

## Verdict: fixed with approved replacement semantics

The user approved provider-neutral original-date identity and replacement semantics after Step 1. The 4.x implementation and final validation are recorded below; v5 remains a separate port.

## Step 1: confirmed reproduction (historical)

The reported display is confirmed on current main **4.14.0** (`273a03049f0f56bee266c1cbb90b55a100ee2cb2`). Neither #2328 nor #2412 fixes it. It is the native-task limitation left open by #2319, not a duplicate of that PR's already-fixed recorded-marker case. #523 is related completion/undo identity work, not the same calendar report.

Read #2396 and its complete comments response first: there were **no comments** on 2026-10-23. Reporter: @martin-forge (Martin Ball). Also read #2319, #2328, #2412 and #523, including their comments.

At the end of Step 1, only the diagnosis and expected-failure reproducer were committed (`5de87d929ded41a0cce7080e40c4f1e938b291e1`). No runtime behavior or user-facing docs changed in that investigation commit. Step 2 below supersedes that expected-failure status.

## Live evidence

Isolated desk session: <https://desk-gcp.callumalpass.net/tn-2396/>. The recording and summary remain available after destroying the temporary desktop.

- Obsidian **1.14.4**, vault verified as `/config/vaults/tasknotes-e2e-vault`.
- Used official 4.14.0 release assets. The annotated tag dereferences to the worktree's main commit above. `main.js` SHA-256 matched GitHub's asset digest: `aa3aaccf98e3c26efab990f83de631e3dbeca2ca0d28584b77247cb7e26ed0b5`.
- Google Calendar/export disabled; no `googleCalendar*` frontmatter and no `due` date.
- Actual test day was **23 October 2026**, not the reporter's 12 October. Viewing 12–18 October still reproduced the same duplicate; no clock spoofing was needed.

All times below are desktop/local time (Australia/Sydney, UTC+11), 2026-10-23:

1. **22:30:35–22:30:58:** Create the exact annual example, scheduled `2026-10-18`, recurrence `DTSTART:20261018;FREQ=YEARLY`. Open a native Bases `tasknotesCalendar` in `listWeek`, seven days, scheduled + recurring visible, due/completed/skipped hidden. Initially one entry on 18 October.
2. **22:30:59–22:31:01:** Call `taskService.updateProperty(task, "scheduled", "2026-10-12")`, matching the reporter's service-boundary reproduction. Saved schedule is `2026-10-12`; recurrence is unchanged; no original-date marker is written. The visible calendar contains:
   - `next-scheduled-Issue2396-native.md-2026-10-12`
   - `recurring-Issue2396-native.md-2026-10-18`
   Both events carry the same task with `scheduled: 2026-10-12`.
3. **22:32:04–22:32:22, control:** Start another annual parent at 18 October. Materialize its 18 October occurrence first, then change only the child's schedule to 12 October. Include both parent and child in the Base. The child retains `occurrence_date: 2026-10-18`; it appears once, on 12 October, and the parent's 18 October event is suppressed. An initial control query excluded the child by filename; corrected that filter before evaluating the result.
4. **22:32:40:** Inspect the following year. Both parents retain the rule-generated **18 October 2027** occurrence; rescheduling has not shifted the annual cadence. `getEvents()` can include an out-of-range next-scheduled event, so distinguish the visible year's events from the whole returned collection.
5. **22:59 (second run started 22:59:38):** Run the saved E2E spec twice **inside this desk sandbox**, with a temporary CDP-only adapter replacing the local launch helper. The adapter connects only to the sandbox's `127.0.0.1:9224` and verifies the exact vault path. Native initial placement, saved frontmatter, the materialized-note control, and both next-year cadence checks succeed. The final expected single-placement assertion fails with actual dates `["2026-10-12", "2026-10-18"]`; JSON result: `expectedStatus: failed`, actual `failed`, zero unexpected or skipped tests. No local Obsidian/e2e instance was launched or reused.

No Obsidian warning/error messages occurred during these checks.

Reproducer: `e2e/issues/issue-2396-virtual-recurring-reschedule.spec.ts`. It uses the normal isolated launch helper for future repository runs; the desk-only adapter is not committed. Remove its `test.fail` annotation when implementing the agreed behavior.

## Cause and why a renderer-only patch is unsafe

- `src/bases/calendar-core.ts:1153–1160` builds suppression dates only from `googleCalendarExceptionOriginalScheduled` and `googleCalendarMovedOriginalDates`. At `:1246–1252`, rule dates are suppressed only if they equal the current schedule, an explicitly recorded moved-original date, or a materialized occurrence date.
- `src/services/task-service/googleCalendarRecurringExceptions.ts:4–17,26–48` requires an existing Google projection before recording an original occurrence on a schedule change. A fresh native task therefore has no persistent move identity.
- After saving just the new schedule, the calendar cannot reliably recover which original occurrence was moved. Inferring the nearest rule date loses identity for repeated moves, moves across cycles, and legacy/direct-YAML edits.
- Merely removing the Google-projection condition is **not** display-only: `src/services/task-service/taskRecurringPlanning.ts:130–136,219–228` switches completion attribution when that marker exists. Native shifted tasks currently resolve to an original rule date; the Google-exception path records completion against the moved execution date. The difference is already covered by `tests/unit/issues/issue-2064-dynamic-scheduled-dates-completion.test.ts`.
- The Google fields also feed export and cleanup, while Undo snapshots recurrence state. A broad predicate change would silently alter native note frontmatter and completion history, including future Google-export behavior.
- `docs/features/recurring-tasks.md` documents independent pattern and execution scheduling, including before-DTSTART and far-ahead schedules. It explicitly defines stable original identity for **materialized** notes, but not for moved virtual occurrences. Independence alone does not settle whether the original projection should remain: this needs an explicit move/identity contract.

## Approved decision

Changing a native virtual task's `scheduled` date **moves/replaces its original occurrence**, retaining the original rule date as its stable identity for calendar suppression, completion, skip and Undo. Implement provider-neutral identity rather than a nearest-date calendar heuristic or a widened Google predicate. Preserve existing Google compatibility; do not invent an identity for old off-pattern notes.

The materialize-first control remains a working alternative. A per-view Bases filter cannot establish missing occurrence identity; disabling recurring projections hides all future pattern entries, not just this duplicate.

## v5

**The v5 line needs the same identity resolution.** Read-only inspection of `feat/v5-mdbase-next-backend` at `01cd5c66a46d47bfc87dcc393067742dbb858199` (5.0.0-beta.5), and the v5 main-sync branch, shows the same provider-gated tracking and Google-marker-only calendar suppression. This is **inferred from source**, not a live v5 reproduction. The port must carry `recurrence_original_date` through the v5 model/schema, frontmatter and mdbase read/write/patch paths (including explicit deletion), Bases signatures, materialization, completion/skip and Undo receipts. It also needs the default list/Kanban-versus-explicit-pattern identity distinction and the same regression matrix. The 4.x app currently wraps model mapping because the shared model does not yet recognize the field. No other worktree was modified.

## Step 1 validation (historical)

- `rpnpm test --runInBand` on the recurring visibility, dynamic scheduled-date completion, update planning and recurring Undo suites: **4 suites / 38 tests passed**.
- Desk E2E run: **one expected failure** at the native single-placement assertion, all prerequisites/control/cadence checks succeeded; not a passing regression fix.
- Initial `rpnpm lint`: TypeScript ESLint, review-type lint and architecture conformance passed; CSS lint could not resolve the undeclared transitive `postcss-selector-parser` under pnpm's isolated linker.
- Initial `rpnpm typecheck`: missing hoisted `moment` and generated `src/releaseNotes.ts`; initial build generated release notes but remained blocked on `moment`.
- Follow-up **passed** via `rpnpm run validate:2396`, a temporary local script executing the unchanged `pnpm run lint && pnpm run build && pnpm run typecheck` scripts on the remote builder. This includes strict TS/review-type/CSS lint, architecture conformance, production compilation/bundling and typecheck. Used pnpm's hoisted linker to match this npm project's existing transitive dependency assumptions; build ran before typecheck to supply generated release notes. The remote release-note generator logged missing `.git` metadata (expected in rpnpm) and used its fallback; this was not a release candidate or a replacement for the verified official live-test asset.

The repository uses an npm lockfile. Remote checks used a temporary imported pnpm lock/config and validation script, all removed afterward: there are no committed dependency/package changes. No lint rules were disabled. The full Jest suite was not run in Step 1; the 38 relevant tests above were the selected scope.

## Step 2 implementation

- Added optional mapped `recurrence_original_date` (`recurrenceOriginalDate` in settings/model-facing field names). Old settings resolve its default name; strict real date-only values, custom names, collision validation, frontmatter/Bases/cache signatures and mdbase schema are covered without requiring migration.
- Capture only a known original rule occurrence when moving a native scheduled-anchored cursor. A missing DTSTART is pinned to the **old** schedule. Repeated moves retain identity; back-to-original and explicit rule/anchor changes clear it. Simultaneous rule/schedule edits preserve the requested rule/removal.
- Calendar placement and identity are separate, including scheduled-to-due spans. Suppress the original projection and materialized parent duplication, but retain a distinct actual rule occurrence if it shares the landing day.
- Completion/skip, default list/Kanban controls and materialization use the pending identity. Explicit generated calendar dates stay authoritative; a known off-pattern execution date can alias the pending original. Materialization normalizes before lookup/dedup/planning and keeps the moved placement/time and original `occurrence_date`.
- Selecting a next occurrence clears the marker even when its date equals the old moved placement. Materialized parent updates explicitly persist mapped deletion outside the older model patch mapper. Exhaustion keeps the marker and reopening keeps the moved placement. Processing another projected occurrence does not abandon the pending move.
- Native completion/skip preserves both execution-span endpoints for next-cycle offsets; the legacy unmarked heuristic remains unchanged. Undo snapshots the marker with schedule/history and refuses conflicting later marker edits.
- Ordinary list/board cards keep targeting the new scheduled cursor after marker consumption, rather than reverting to the generic view date. Explicit calendar cards do not opt into this current-occurrence behavior.
- Added user-facing recurrence/property docs and the unreleased acknowledgement of @martin-forge. Four read-only review rounds ended with no remaining must-fix findings. No v5 files or other worktrees were changed.

## Step 2 validation

Full unit validation uses the unchanged `test:unit` command after generating the normal `src/releaseNotes.ts` prerequisite in the same remote invocation. An initial full run had 723 passing suites and 13 import failures because rpnpm's next source sync removes that generated source; generating it before Jest resolves all 13. No assertions or lint rules were weakened.

Final remote full unit run: **736 suites / 4,717 tests passed**, with **70 existing skipped suites / 1,000 skipped tests and 4 todo**. The focused recurrence/mapping/Google/Undo run also passed **8 suites / 152 tests** before the additional UI/span regressions. Temporary pnpm lock/workspace and runner scripts are validation-only and are not part of the fix.

Final `rpnpm` strict lint (TS/review-type/CSS/architecture), production build, typecheck and bundle budget all **passed** after the final UI correction. Bundle: **4,657,953 bytes**, below 5,000,000. The remote release-note generator uses its fallback because `.git` is intentionally not synced; the plugin version remains 4.14.0, not a release candidate.

### Final live verification

Fresh isolated desk: <https://desk-gcp.callumalpass.net/tn-2396-fixed/>; recording/summary retained, desktop **destroyed**. Obsidian 1.14.4; vault verified as `/config/vaults/tasknotes-e2e-vault`. Built plugin SHA-256: `208197fe63b9df591a94f7e66b0184fac04ad355f67b3577dec05b19bb116264`, verified inside the desktop after reload. No local Obsidian instance or local launch/reuse harness was used; the temporary CDP-only adapter ran inside desk and verified the vault.

Times are Australia/Sydney, **24 October 2026**:

- **08:56:** Initial native annual and timed-materialized completion/Undo checks passed.
- **09:02–09:06:** The extra list UI check first needed status added to the Base's displayed properties. Its reorder handle overlapped pointer hit-testing, so the saved regression activates the real accessible status control with **Enter**, not a forced click. A subsequent real second activation exposed the generic-view-date caller bug described above; fixed it, added regression coverage, rebuilt/reloaded and reran the full unit suite.
- **09:10:21:** Final saved E2E: **3 passed, 0 skipped/expected failures**. (1) Exact native annual **18→12 October** move appears once, retains original event identity, and preserves 18 October 2027 cadence; materialize-first control stays single. Completing the moved occurrence records `2026-10-18`, advances to `2027-10-18`, clears the marker and displays the correct notice. Clicking real **Undo** restores moved placement, history and marker. (2) Timed moved materialization from its execution date keeps original `occurrence_date` and moved scheduled/due times; completion removes the parent's persisted marker, and real Undo restores parent and child. (3) The ordinary list status control activated twice on a future weekly 11→18 October collision records 11 then 18 and advances to 25, including the same-placement first advancement.
- **09:10:40:** Additional live native virtual timed-span controls passed for **both completion and skip**: move 18–20 October 2027 to 12–14, then advance to 18–20 October 2028 with `09:00`/`17:00` intact, original-date history and no marker.

No Obsidian warnings/errors occurred. Test notes were removed and only this temporary desktop was destroyed. The pointer overlap was not changed as part of the recurrence fix; mouse activation of that narrow list control is not claimed as passing.

### Remaining design questions

None blocking the approved contract. Historical off-pattern notes without identity are intentionally not migrated by inference; direct YAML edits must supply a known identity. Google format unification and the v5 model/schema/write-path port remain separate work, not silently included here. No pushes, merges, GitHub comments or other GitHub mutations were made.
