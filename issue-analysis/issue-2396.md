# #2396: moved virtual recurring occurrence appears twice

## Step 1 verdict: needs-decision

The reported display is confirmed on current main **4.14.0** (`273a03049f0f56bee266c1cbb90b55a100ee2cb2`). Neither #2328 nor #2412 fixes it. It is the native-task limitation left open by #2319, not a duplicate of that PR's already-fixed recorded-marker case. #523 is related completion/undo identity work, not the same calendar report.

Read #2396 and its complete comments response first: there were **no comments** on 2026-10-23. Reporter: @martin-forge (Martin Ball). Also read #2319, #2328, #2412 and #523, including their comments.

No runtime behavior or user-facing docs have been changed. The saved E2E reproducer's final assertion is explicitly an **expected failure**, not a claimed fix. No unreleased note is appropriate for investigation/tests alone.

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

## Decision and recommendation

**Should changing a native virtual task's `scheduled` date move/replace its original occurrence, retaining the original rule date as its stable identity for calendar suppression, completion, skip and Undo?**

Recommend **yes**, using provider-neutral persisted move identity, consistent with materialized notes and existing native completion history. Do not implement just a nearest-date calendar heuristic or widen the Google predicate. The implementation should cover repeated/back-to-original moves, cycle crossings, history, next-schedule advancement, Undo, time-only edits, and legacy/direct-YAML behavior, while preserving Google compatibility. Older files with only an off-pattern schedule must not have an original date invented without an explicit policy.

Until that decision, a working alternative is **Open or create occurrence note** on the original occurrence, then reschedule that child. A per-view Bases filter cannot establish missing occurrence identity; disabling recurring projections hides all future pattern entries, not just this duplicate.

## v5

**The v5 line needs the same identity resolution if replacement semantics are approved.** Read-only inspection of `feat/v5-mdbase-next-backend` at `01cd5c66a46d47bfc87dcc393067742dbb858199` (5.0.0-beta.5), and the v5 main-sync branch, shows the same provider-gated tracking and Google-marker-only calendar suppression. This is **inferred from source**, not a live v5 reproduction. Any provider-neutral persisted field must also be carried through v5's schema/write paths. No other worktree was modified.

## Validation

- `rpnpm test --runInBand` on the recurring visibility, dynamic scheduled-date completion, update planning and recurring Undo suites: **4 suites / 38 tests passed**.
- Desk E2E run: **one expected failure** at the native single-placement assertion, all prerequisites/control/cadence checks succeeded; not a passing regression fix.
- Initial `rpnpm lint`: TypeScript ESLint, review-type lint and architecture conformance passed; CSS lint could not resolve the undeclared transitive `postcss-selector-parser` under pnpm's isolated linker.
- Initial `rpnpm typecheck`: missing hoisted `moment` and generated `src/releaseNotes.ts`; initial build generated release notes but remained blocked on `moment`.
- Follow-up **passed** via `rpnpm run validate:2396`, a temporary local script executing the unchanged `pnpm run lint && pnpm run build && pnpm run typecheck` scripts on the remote builder. This includes strict TS/review-type/CSS lint, architecture conformance, production compilation/bundling and typecheck. Used pnpm's hoisted linker to match this npm project's existing transitive dependency assumptions; build ran before typecheck to supply generated release notes. The remote release-note generator logged missing `.git` metadata (expected in rpnpm) and used its fallback; this was not a release candidate or a replacement for the verified official live-test asset.

The repository uses an npm lockfile. Remote checks used a temporary imported pnpm lock/config and validation script, all removed afterward: there are no committed dependency/package changes. No lint rules were disabled. The full Jest suite was not run; the 38 relevant tests above were the selected scope.
