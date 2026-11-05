# Redesign round 2: end-to-end triage

Date: November 5, 2026 (Australia/Melbourne).

## Candidate and boundaries

- Branch: `redesign/r2-triage`, fast-forwarded from `106a0551e` to the required `014038c903b88a70f96252dc26ca239a12c8a741` before editing.
- Dependencies: `node_modules` links to `/home/calluma/projects/tasknotes-worktrees/plugin-redesign/node_modules`. The calendar dependency is unchanged.
- Native testing uses `e2e/obsidian.ts`, Obsidian 1.14.2, this worktree's test vault, debug port 9396, dedicated profiles, and `TASKNOTES_E2E_REUSE_OBSIDIAN=0`. Every successful launch logs verification of the vault's absolute path.
- No redesign, publication, push, tag, PR, or `.ops/` change is included.
- Evidence root: `/tmp/tasknotes-r2-triage/`. JSON results, console logs, screenshots and failure traces are retained there.

## Evidence-count correction

The supplied JSON has **41 functional failures before the first launch failure**, not 42. Record 42 is `pr-2188-repeat-current-task.spec.ts:10`'s `beforeAll` timeout. Records 43–80 are the 38 subsequent failures excluded by the brief. The table retains the supplied ordering and includes record 42 as infrastructure rather than inventing a product-regression or stale-spec verdict for it.

## Source fixes

1. `src/ui/taskViewKeyboard.ts`: list/board action palettes previously passed `new Date()` to recurring actions when no calendar occurrence date was supplied. A native keyboard reproduction recorded `2026-11-04` instead of the pending moved identity `2027-10-11`. Use the existing `resolveRecurringTaskActionDate` for recurring tasks; preserve explicitly supplied calendar dates. The same two completion-history, progression and identity assertions now pass through the keyboard palette.
2. `src/ui/recurringCompletionNotice.ts`: distinguish a thrown persistence failure from a rejected stale receipt, restoring the existing translated “Could not undo the recurring task change.” feedback and logging. Restore the authored translations from the pre-redesign catalogues, not new English placeholders.
3. `src/ui/kit/toast.ts`: do not overwrite newer/specific feedback when an Undo rejects. The rejected receipt remains in history. A focused Jest test verifies the specific message survives and history is not skipped.
4. `src/bases/KanbanView.ts`: the full run exposed a separate accessibility regression. Obsidian's `setTooltip` overwrote the translated collapse action's `aria-label` with only the column name. Reuse the existing translated action for both tooltip and accessible name. The unchanged German `/Spalte/` assertion, native keyboard/touch collapse, actual drops, and restart persistence pass in `locale-fixed.json`. PR 2259's author was verified as `nesyeklaf`; the release note acknowledges that contribution.
5. `src/modals/taskModalFocusGuards.ts`: the second sectioned run caught a real intermittent tag-edit corruption after the disclosure selector was repaired. The task was unexpectedly renamed to `false-falsetask, health`, so polling the original path threw rather than finding the edited tags. The pending title-focus timer only guarded open pickers, not another already-focused editable field. A new fake-timer unit case failed before the fix (1 failed, 13 passed, `focus-before.log`) and passed after it (14 passed, `focus-after.log`). Initial title focus now respects another focused editable field in the same modal. This is a focus/data-integrity fix, not a delay or relaxed assertion. Issue 2140's author was verified as `3zra47` and acknowledged.

The recurring second-file failure test still checks that compensation leaves the parent at `2036-10-21`, its completion history at `['2035-10-21']`, and the materialized occurrence completed. No disk-restoration logic or recurrence rules were rewritten.

## Spec preservation and explicit incompatibility

- Date-picker selectors now target the actual `option` named `+1 day`. All eight raw YAML comparisons retain their exact date-only or `T21:37` expectations.
- Tags, contexts and attachment removal explicitly open the existing modal disclosure. Existing raw-list, no-op-byte, file-retention and attachment-link assertions remain.
- Creation uses the existing `Create task` label; edit continues to use `Save`. All input-retention, failure-feedback, enabled-button and retry assertions remain.
- Feedback selectors target shared toasts where those operations migrated. Creation write errors retain their native Notice path.
- Collapsed subgroup selection targets `Toggle group`, not the now-ambiguous collection of all header buttons.
- Calendar group movement polls the complete pair of notes, including both deadlines, after move and Undo. Baseline reproduced the opposite ordering race during Undo: Bravo had restored while Alpha was still awaiting restoration. Updated native runs verify both eventual complete states. No polling timeout was widened.
- Reload persistence waits for `workspace.layoutReady` before asking Obsidian to create/open a leaf. Both reloads and collapsed/expanded persisted values remain asserted.
- **Unadapted assertion:** issue 2412's original “stale Undo cannot undo a later completion” UI case requires two simultaneous actionable notices. Shared history intentionally exposes one current toast. Its `toHaveCount(2)` and remaining assertions are retained rather than weakened, removed, or skipped. The case remains a known failure. A separate native test captures two receipts through the existing `onUndo` callback, verifies that the stale receipt returns false without advancing/restoring the series, and verifies that the latest receipt restores only its own occurrence. That is service-safety coverage, not a claim that the obsolete two-toast UI case passed.
- Further full-run stale selectors were adapted without dropping assertions: recurring next-status Undo uses the shared toast; multilingual title validation checks the same translated error in its inline field alert; multilingual Cancel explicitly chooses the existing translated Discard changes confirmation before asserting closure. Localized group creation targets the header add button, and real group/boolean drops target column headers rather than potentially collapsed card wells. All raw property, ordering, locale and no-untitled-file checks remain. `locale-fixed.json` has five passes covering the collapse test and all four bundled-localization tests.
- PR 2259's restart now retains the configured debug port after closing its owned instance. Its first diagnostic rerun inherited the old spec's explicit `+10` port override (9406); subsequent runs use 9396 throughout. No instance was reused or attached to the user's vault.

## Keyboard completion assessment

**Coordinator resolution: resolved by status-click revert; post-merge confirmation belongs to the owner.** During the final acceptance run the owner directed that status clicks must cycle status and is implementing that change separately on `redesign/linear-in-obsidian`. That change is not in this tested candidate. No status-click implementation was changed by this sub-agent, and no passing post-revert interaction result is claimed here.

On the tested candidate, Enter on the status glyph opens its explicit status picker. Alt+Enter is not an equivalent to Alt-click: the shared interactive-control keyboard handler calls `.click()` without carrying modifiers. The working keyboard route is **Ctrl/Cmd+K → search “Complete this occurrence” → Enter**. It is reachable and explicitly labelled, but it is **not a single-action completion shortcut**. No new shortcut or redesigned control was added. The revised issue-2396 test exercises that route twice and retains the exact original occurrence/history/progression checks. The separate palette occurrence-date correction remains a reproduced data-integrity fix, independent of the owner's click revert.

Interaction-protection distinction: issue 2396 now drives the named keyboard palette action, not Enter-on-status. Its data-integrity assertions are unchanged, but it does not claim to preserve or verify the former single-Enter interaction. The PR 2492 cases retain their original single-click expectations and remain separate compatibility gates.

## Launch investigation

- Historical evidence distinguishes two stages: the first pr-2188 timeout did not record a connected CDP session; later failures did connect and the Xvfb snapshot showed “Loading cache…” before workspace/plugin readiness. These are not proof of a missing Undo message or a particular test-body regression.
- Fresh-profile targeted launches succeed with the same runtime, plugin bundle, harness, worktree vault and debug port. The fresh Xvfb control ran the corrected keyboard occurrence test and both pr-2188 viewport cases: **3 passed, exit 0**, in `xvfb.json` / `xvfb.log`.
- At investigation time, the host had roughly 59 GiB available RAM, 37 GiB free on `/tmp`, and only about 6 MiB used in `/dev/shm`; immediate memory/disk/shared-memory exhaustion was not present. This does not establish what resources were available during the historical failure.
- The 60-second CDP startup allowance can consume the entire default 60-second Playwright hook allowance before subsequent readiness work and cleanup. This is a harness risk, not a demonstrated cause of the original stall. No timeout was enlarged or readiness check removed.
- The final fresh-section run completed in about 38 minutes with **100 verified native launches**, all on port 9396, and no launch/readiness failure. Together with the earlier complete native-display and Xvfb runs, this demonstrates a usable isolated sectioning workaround, not attribution of the historical stall.
- **Root cause remains unknown.** Fresh launches rule out a deterministic inability of this runtime/bundle to launch pr-2188 under Xvfb. They do not rule out long-lived cache/profile contamination, intermittent Electron/host behaviour, or plugin effects that accumulate over a long run. A plugin-disabled reproduction and attribution of the original historical hang were not performed.

## Individual failure verdicts

Original files are relative to `e2e/`; line numbers refer to the supplied failure record. “Targeted” means `targeted.json`, not a source-only inference. There are 38 stale specs, three real regressions and one infrastructure record. Record 23 additionally carries the owner's explicit status-click-revert resolution; that interaction change awaits their post-merge confirmation.

| # | Original case | Verdict | Native evidence |
| --- | --- | --- | --- |
| 1 | `calendar-batch.spec.ts:151` — group dragging keeps relative days, local times and deadlines, and offers Undo | STALE SPEC | Baseline reproduced the reverse-order Undo read race; joint move/Undo polling passes for both notes and deadlines. |
| 2 | `issues/issue-1894-relative-date-keeps-time.spec.ts:45` — tasknotesTaskList scheduled +1 day preserves date-only | STALE SPEC | Targeted pass: actual +1 day option is reachable; exact raw YAML date/time comparison passes. |
| 3 | `issues/issue-1894-relative-date-keeps-time.spec.ts:45` — tasknotesTaskList scheduled +1 day preserves T21:37 | STALE SPEC | Targeted pass: actual +1 day option is reachable; exact raw YAML date/time comparison passes. |
| 4 | `issues/issue-1894-relative-date-keeps-time.spec.ts:45` — tasknotesTaskList due +1 day preserves date-only | STALE SPEC | Targeted pass: actual +1 day option is reachable; exact raw YAML date/time comparison passes. |
| 5 | `issues/issue-1894-relative-date-keeps-time.spec.ts:45` — tasknotesTaskList due +1 day preserves T21:37 | STALE SPEC | Targeted pass: actual +1 day option is reachable; exact raw YAML date/time comparison passes. |
| 6 | `issues/issue-1894-relative-date-keeps-time.spec.ts:45` — tasknotesKanban scheduled +1 day preserves date-only | STALE SPEC | Targeted pass: actual +1 day option is reachable; exact raw YAML date/time comparison passes. |
| 7 | `issues/issue-1894-relative-date-keeps-time.spec.ts:45` — tasknotesKanban scheduled +1 day preserves T21:37 | STALE SPEC | Targeted pass: actual +1 day option is reachable; exact raw YAML date/time comparison passes. |
| 8 | `issues/issue-1894-relative-date-keeps-time.spec.ts:45` — tasknotesKanban due +1 day preserves date-only | STALE SPEC | Targeted pass: actual +1 day option is reachable; exact raw YAML date/time comparison passes. |
| 9 | `issues/issue-1894-relative-date-keeps-time.spec.ts:45` — tasknotesKanban due +1 day preserves T21:37 | STALE SPEC | Targeted pass: actual +1 day option is reachable; exact raw YAML date/time comparison passes. |
| 10 | `issues/issue-2140-visible-tag-edits.spec.ts:47` — visible nested tag removal persists: scalar=false, prefixed=false | REAL REGRESSION | The original disclosure locator was stale, but the repaired test later exposed delayed title focus stealing tag typing and renaming the note. The focus-guard unit repro fails before and passes after the source fix; exact native persisted-list assertions remain. |
| 11 | `issues/issue-2140-visible-tag-edits.spec.ts:47` — visible nested tag removal persists: scalar=false, prefixed=true | STALE SPEC | Targeted pass: open disclosure, edit nested tags, save and reopen; original persisted-list check passes. |
| 12 | `issues/issue-2140-visible-tag-edits.spec.ts:47` — visible nested tag removal persists: scalar=true, prefixed=false | STALE SPEC | Targeted pass: open disclosure, edit nested tags, save and reopen; original persisted-list check passes. |
| 13 | `issues/issue-2140-visible-tag-edits.spec.ts:47` — visible nested tag removal persists: scalar=true, prefixed=true | STALE SPEC | Targeted pass: open disclosure, edit nested tags, save and reopen; original persisted-list check passes. |
| 14 | `issues/issue-2148-nullable-lists.spec.ts:103` — adding a context to YAML null never carries a fake null string into the file | STALE SPEC | Targeted pass after opening disclosure; raw YAML null/list and empty-item assertions unchanged. |
| 15 | `issues/issue-2148-nullable-lists.spec.ts:114` — clearing the last item in every list does not persist null strings | STALE SPEC | Targeted pass after opening disclosure; raw YAML null/list and empty-item assertions unchanged. |
| 16 | `issues/issue-2276-filename-sanitized-notice.spec.ts:33` — creating a task with / in its title names the sanitized file | STALE SPEC | Targeted pass: Create task, sanitized-filename feedback in toast, original full title retained. |
| 17 | `issues/issue-2381-task-movement.spec.ts:199` — parent drop adds a relationship without moving groups or manual rank | STALE SPEC | Targeted pass: Added as a subtask of Done is visible in the shared toast; grouping/rank preserved. |
| 18 | `issues/issue-2381-task-movement.spec.ts:317` — parent Undo refuses to replace later project edits | STALE SPEC | Targeted pass: Cannot undo is visible in toast and later project/group field edits remain unchanged. |
| 19 | `issues/issue-2381-task-movement.spec.ts:508` — collapsed subgroups remain usable destinations | STALE SPEC | Targeted pass: named Toggle group button collapses subgroup; drag persists low priority. |
| 20 | `issues/issue-2381-task-movement.spec.ts:807` — Undo refuses to overwrite a later edit to a moved field | STALE SPEC | Targeted pass: Cannot undo is visible in toast and later project/group field edits remain unchanged. |
| 21 | `issues/issue-2396-virtual-recurring-reschedule.spec.ts:65` — a moved native annual occurrence should replace its rule placement, like a materialized note | STALE SPEC | Targeted pass: completion-date/next-date feedback in shared toast; original occurrence, parent and Undo checks retained. |
| 22 | `issues/issue-2396-virtual-recurring-reschedule.spec.ts:177` — a timed moved occurrence materializes under its original identity and completes with reversible parent progression | STALE SPEC | Targeted pass: completion-date/next-date feedback in shared toast; original occurrence, parent and Undo checks retained. |
| 23 | `issues/issue-2396-virtual-recurring-reschedule.spec.ts:231` — the ordinary list checkbox completes the pending move before its shared landing-date occurrence | REAL REGRESSION; resolved by status-click revert | Owner will confirm the original status interaction after merging their separate revert; it is not in this candidate. Independently, reachable Ctrl+K palette first wrote 2026-11-04, not 2027-10-11. Existing action-date resolver fixes both exact completion-history checks; fresh Xvfb passes the palette route, not the reverted click route. |
| 24 | `issues/issue-2412-recurring-completion-undo.spec.ts:44` — annual checkoff shows years and Undo restores that occurrence, due offset and checklist | STALE SPEC | fixed.json passes with shared-toast selectors; original recurrence, due-offset, checkbox, conflict and note-retention checks retained. |
| 25 | `issues/issue-2412-recurring-completion-undo.spec.ts:59` — stale Undo cannot undo a later completion; latest Undo removes only its own occurrence | STALE SPEC | Still fails: two simultaneous actionable notices are incompatible with one-toast history. Count assertion retained; new receipt-safety native test added separately. |
| 26 | `issues/issue-2412-recurring-completion-undo.spec.ts:74` — Undo preserves unrelated edits but refuses a changed recurrence rule | STALE SPEC | fixed.json passes with shared-toast selectors; original recurrence, due-offset, checkbox, conflict and note-retention checks retained. |
| 27 | `issues/issue-2412-recurring-completion-undo.spec.ts:100` — bounded series show no next occurrence | STALE SPEC | fixed.json passes with shared-toast selectors; original recurrence, due-offset, checkbox, conflict and note-retention checks retained. |
| 28 | `issues/issue-2412-recurring-completion-undo.spec.ts:109` — completion-anchored Undo restores the original anchor and timed schedule | STALE SPEC | fixed.json passes with shared-toast selectors; original recurrence, due-offset, checkbox, conflict and note-retention checks retained. |
| 29 | `issues/issue-2412-recurring-completion-undo.spec.ts:122` — edits arriving during completion are never captured as reversible writes | STALE SPEC | fixed.json passes with shared-toast selectors; original recurrence, due-offset, checkbox, conflict and note-retention checks retained. |
| 30 | `issues/issue-2412-recurring-completion-undo.spec.ts:171` — materialized completion receipts exclude later parent completions during webhooks | STALE SPEC | fixed.json passes with shared-toast selectors; original recurrence, due-offset, checkbox, conflict and note-retention checks retained. |
| 31 | `issues/issue-2412-recurring-completion-undo.spec.ts:202` — a failed occurrence write rolls back the parent Undo rather than leaving partial state | REAL REGRESSION | Operational Undo write failure had lost its distinct feedback. Restored message passes in fixed.json, together with all parent/occurrence compensation checks. |
| 32 | `issues/issue-2412-recurring-completion-undo.spec.ts:230` — note-backed occurrence Undo restores parent and occurrence without deleting notes | STALE SPEC | fixed.json passes with shared-toast selectors; original recurrence, due-offset, checkbox, conflict and note-retention checks retained. |
| 33 | `issues/issue-2421-save-validation.spec.ts:24` — creation: button validation failure retains input and allows retry | STALE SPEC | Targeted pass: Create task for creation / Save for edit; title, details, enabled button and successful retry assertions retained. |
| 34 | `issues/issue-2421-save-validation.spec.ts:24` — creation: button write failure retains input and allows retry | STALE SPEC | Targeted pass: Create task for creation / Save for edit; title, details, enabled button and successful retry assertions retained. |
| 35 | `issues/issue-2421-save-validation.spec.ts:24` — creation: keyboard validation failure retains input and allows retry | STALE SPEC | Targeted pass: Create task for creation / Save for edit; title, details, enabled button and successful retry assertions retained. |
| 36 | `issues/issue-2421-save-validation.spec.ts:24` — creation: keyboard write failure retains input and allows retry | STALE SPEC | Targeted pass: Create task for creation / Save for edit; title, details, enabled button and successful retry assertions retained. |
| 37 | `issues/issue-2421-save-validation.spec.ts:24` — edit: button write failure retains input and allows retry | STALE SPEC | Targeted pass: Create task for creation / Save for edit; title, details, enabled button and successful retry assertions retained. |
| 38 | `issues/issue-2421-save-validation.spec.ts:24` — edit: keyboard write failure retains input and allows retry | STALE SPEC | Targeted pass: Create task for creation / Save for edit; title, details, enabled button and successful retry assertions retained. |
| 39 | `issues/issue-2421-save-validation.spec.ts:24` — edit: confirmation write failure retains input and allows retry | STALE SPEC | Targeted pass: Create task for creation / Save for edit; title, details, enabled button and successful retry assertions retained. |
| 40 | `issues/issue-2484-kanban-collapse-persists.spec.ts:58` — collapsed columns stay collapsed after the app reloads | STALE SPEC | Targeted pass: wait for layoutReady before getLeaf; both reloads retain collapsed/expanded disk configuration. |
| 41 | `issues/pr-1708-task-attachments.spec.ts:126` — saving imports the file, writes a canonical link, and unlinking keeps the file | STALE SPEC | Targeted pass: open disclosure before Remove attachment; canonical link removed but imported file remains. |
| 42 | `issues/pr-2188-repeat-current-task.spec.ts:10` — repeat confirmation and editor cancellation at 1400px | INFRASTRUCTURE | This is the first launch timeout, not a 42nd functional failure. Both viewport cases pass in fresh-profile Xvfb control; historical root cause unknown. |

## Additional protections not silently rewritten

The complete suite reaches tests that the supplied interrupted run did not. These protections are left intact rather than changing the redesign or converting an unverified mismatch into a pass:

| Protection | Observed mismatch / limitation |
| --- | --- |
| `issues/pr-2260-kanban-status-colors.spec.ts:66` | Changing a custom status colour leaves the neutral column background unchanged. The spec protects live column-body tinting; changing it to check only a glyph would change its protection. |
| `issues/pr-2492-recurring-status-click.spec.ts:123,139` | **Resolved by status-click revert**, per coordinator; owner confirms after merging their separate change. Raw failures on this candidate remain: the glyph opens a picker rather than cycling/completing. Original single-click workflow/history assertions remain; the palette route does not prove them. |
| Four narrow cases in `presentation-round2.spec.ts:94` | The due metadata element is hidden at 430px. The exact “both dates visible” assertions remain. No claim is made that overflow/disclosure is equivalent to the protected simultaneous visibility. |
| `presentation-round2.spec.ts:208` | The property-event card contains an input while its spec requires zero. The input assertion was not removed or narrowed to a different input type. |
| `recurring-status-drop.spec.ts:148` | The data progression checks pass, but the aggregate movement toast lacks the task-specific `Next:` feedback expected by this route. Updating `.notice` to `.tn-toast` alone cannot preserve that message protection. The original text assertion remains, so this test does not reach its later Undo assertions. |
| `issues/issue-2412-recurring-completion-undo.spec.ts:59` | Two simultaneously actionable notices are incompatible with the one-current-toast surface, as explained above. Receipt-safety coverage is separate, not a substitute green UI result. |
| `issues/issue-2381-task-movement.spec.ts:357` | Final full run returned null for the Source card's drag bounding box during the Markdown-link case. The failure snapshot contains Source again, but that alone does not prove a harness-only race. A fresh-profile isolated rerun passes with the exact Markdown-frontmatter and duplicate-parent assertions unchanged (`markdown-link-control.json`, exit 0). Root cause of the intermittent failure remains unconfirmed. |
| `undo-round2.spec.ts:258` | Final full run passed the initial five-note snapshot restoration but did not find Task 1 in the in-progress lane after a separate status update. The cross-column drop and subsequent Undo assertions were not reached in that run. The unchanged full-file fresh-profile control then passed all 16 tests, including the complete cross-column snapshot restoration (`undo-final-control.json`, exit 0). Root cause of the intermittent full-run failure remains unconfirmed; the control is not subtracted from full-suite failures. |

Other diagnostic failures are recorded separately, not labelled harmless: the autocomplete dismissal case in issue 2404 failed intermittently; PR 1477's two cases encountered ignored `filter-*.ics` files left by an earlier run (its own teardown removes subscriptions but not those files). The final runner archives those exact owned fixture files as well as untracked notes. Kanban zero-native-notice gates now explicitly dismiss only Obsidian's exact secret-storage system warning using its own Don't show again action before the task operation; they still assert zero native notices after the operation and one shared Undo toast. No TaskNotes feedback is filtered out of those assertions.

## Validation results

The first complete sectioned run, on source commit `bfbf1a9a8a65e9abb18546d15d1e38aa7441b5c6`, completed all 200 spec files: **472 passed, 19 failed, 820 skipped, 0 did not run**, exit 1. These are raw results, not a green acceptance claim. The 820 skips are the suite's existing skips; no new skip or weakened assertion was introduced. Evidence: `full/sections.json`, `full/section-01.json` through `full/section-10.json`, and `full/failures.json` under the evidence root.

| First-run section | Passed | Failed | Skipped | Exit |
| --- | ---: | ---: | ---: | ---: |
| 01 | 92 | 1 | 65 | 1 |
| 02 | 0 | 0 | 122 | 0 |
| 03 | 0 | 0 | 110 | 0 |
| 04 | 12 | 0 | 70 | 0 |
| 05 | 99 | 1 | 0 | 1 |
| 06 | 24 | 0 | 40 | 0 |
| 07 | 0 | 0 | 131 | 0 |
| 08 | 0 | 0 | 118 | 0 |
| 09 | 31 | 6 | 67 | 1 |
| 10 | 214 | 11 | 97 | 1 |

Focused follow-up evidence, not replacement full-suite totals:

- `followup.json`: **39 passed, 15 failed**, exit 1, rerunning the ten newly failing files under harness-owned Xvfb. The native-window dimension check and both Kanban duplicate-notice checks pass there. The initial desktop run's native window was 1233×2075 instead of the requested 1400×900. A system secret-storage warning, not duplicate TaskNotes feedback, caused the two zero-native-notice assertions. This does not establish the original launch-hang cause.
- The first attempt to archive generated fixtures failed with `EXDEV` across the workspace and `/tmp` filesystems; that Xvfb follow-up therefore still had the accumulated fixture notes. The archive was subsequently completed with byte-verified copy then unlink, retaining 94 generated files outside the repo. `calendar-clean.json`: **1 passed**, exit 0, runs the unchanged exact drag/resize write-back assertions against the clean vault. In the failed trace, pointer-down at y=280.84 was inside the all-day area while the timed event's top was clipped; the cleaned fixture control demonstrates a test-state/geometry failure, not evidence of a calendar partial-write defect.
- `additional-fixed.json`: **15 passed, 2 failed**, exit 1, after the accessibility and first additional selector repairs. It exposed a second old localized-drag target and the still-incompatible recurring-drop feedback assertion.
- `locale-fixed.json`: **5 passed**, exit 0, after the localized header-drop target correction. All locale, raw YAML, saved-order, keyboard/touch and persistence assertions remain.

The second Xvfb sectioned run started on `4345bbb52` with a clean tracked vault and byte-archived generated fixtures between sections. It was diagnostic, not the final candidate: the focus issue above was investigated while it ran, and a late spec rebuilt the working-tree bundle. A separate committed-source acceptance run follows those repairs. Final results are appended after that run completes.

That second run completed with **474 passed, 17 failed, 820 skipped, 0 did not run**, exit 1 (`final-full/`). These results include the title-focus race, an intermittent autocomplete dismissal failure, two ignored-ICS fixture collisions and two system-warning failures; they are not silently combined with focused passes to claim a green full run.

After the focus and fixture repairs, `focus-native.json` has **24 passed, exit 0**: all four issue-2140 persisted tag cases, all issue-2404 Enter/autocomplete cases, both PR-1477 ICS filter cases, and every Kanban redesign case, including exact zero-native-notice checks and guarded aggregate Undo. `focus-build.log` records the rebuilt vault-targeted artifact with exit 0.

Final strict checks on source commit `349a00c61bc484621391a989fa4efd98c23fe99f` are in `acceptance-final-checks/`:

| Check | Exit | Result |
| --- | ---: | --- |
| `npm run lint` | 0 | Strict runner exit checked, not inferred from its last output line. |
| `npm run typecheck` | 0 | Passed. |
| `npm run i18n:check` | 0 | Passed; no calendar dependency change or untranslated placeholder introduced. |
| `npx jest --runInBand` | 0 | 788 passed suites, 68 skipped; 6,063 passed tests, 988 skipped, 4 todo. |
| `npm run build` | 0 | Production build passed. |

### Final committed-source full run

On source commit **`349a00c61bc484621391a989fa4efd98c23fe99f`**, `acceptance-final/` records **479 passed, 12 failed, 820 skipped, 0 did not run, 0 flaky retries; exit 1**. All 200 spec files and 1,311 discovered tests are accounted for. The 820 skips are pre-existing; none was added to avoid a failure. Ten sequential sections used fresh owned profiles with reuse disabled and harness-owned Xvfb. There were 100 verified launches and no launch stall. Source/spec drift stayed zero; later report-only changes do not change the tested plugin. Evidence: `sections.json`, all ten JSON/log/artifact sets, `totals.json`, and `failures.json` in that directory.

| Final section | Passed | Failed | Skipped | Exit |
| --- | ---: | ---: | ---: | ---: |
| 01 | 93 | 0 | 65 | 0 |
| 02 | 0 | 0 | 122 | 0 |
| 03 | 0 | 0 | 110 | 0 |
| 04 | 12 | 0 | 70 | 0 |
| 05 | 98 | 2 | 0 | 1 |
| 06 | 24 | 0 | 40 | 0 |
| 07 | 0 | 0 | 131 | 0 |
| 08 | 0 | 0 | 118 | 0 |
| 09 | 34 | 3 | 67 | 1 |
| 10 | 218 | 7 | 97 | 1 |
| **Total** | **479** | **12** | **820** | **1** |

The 12 failures are the ten explicit compatibility gates (two-actionable-toast count; live Kanban column tint; two status-click cases awaiting the owner's revert; four narrow both-date-visibility cases; property-event zero-input count; task-specific recurring-drop feedback), plus the two intermittent movement/Undo cases listed above. No focused rerun is subtracted from the raw full-suite failure count. The exact recurring-drop message assertion still prevents that case's later Undo checks from running. This is **not green acceptance**.

Among the original functional records, the two-toast case remains red; the other original cases pass their adapted routes. In particular, the keyboard case passes through the palette, not a falsely claimed post-revert status click. The owner must verify that original interaction after integrating their revert.

Post-run diagnostic controls are separate: `markdown-link-control.json` has **1 passed, exit 0**, and `undo-final-control.json` has **16 passed, exit 0**, both using fresh isolated profiles, Xvfb, port 9396 and unchanged source/specs. They establish successful controls for the two intermittent failures, not a causal diagnosis or green full run.

Intermediate runs are not acceptance totals:

- `baseline.json`: 12 passed, 4 failed, 1 interrupted, 6 did not run; intentionally interrupted after reproducing the stale notice failures. Exit 130. Its interrupted trace is incomplete.
- `targeted.json`: 92 passed, 3 failed, exit 1, before the two source repairs were complete.
- `fixed.json`: 11 passed, 2 failed, exit 1; this caught that Alt+Enter did not preserve modifiers. It is not claimed as passing keyboard coverage.
- `keyboard.json`: 1 failed, exit 1; recorded the wrong occurrence through the reachable action palette before the source date fix.
- `xvfb.json`: 3 passed, exit 0, after the source fixes.
- An intermediate production build failed while the restored message had not yet received its catalogue translation. The subsequent strict build and catalogue checks are the relevant results; the intermediate failure is retained in `checks/build.log`.

## Commits

- `bfbf1a9a8a65e9abb18546d15d1e38aa7441b5c6` — preserve recurring actions/Undo feedback and adapt the original stale selectors with their data checks retained.
- `4345bbb524c757b3bdf23dcf8768ccb6f3c7ffd4` — retain translated Kanban collapse actions and repair additional exact localized UI routes.
- `349a00c61bc484621391a989fa4efd98c23fe99f` — prevent pending modal title focus from stealing typing in another field; add the failing-before/passing-after timer regression test.
- The final report-only commit is identified in the handoff; all final code gates above refer to `349a00c61bc484621391a989fa4efd98c23fe99f`.

Cleanup completed after the final controls: required tracked-vault restoration and Views cleanup ran; the only remaining change was this report. Generated full-run fixture leftovers were byte-verified and archived outside the checkout. No process was listening on the owned debug port 9396. Source/spec drift from the tested commit and dependency-file drift from the required base both returned exit 0. No `.ops/`, fixture, profile or generated bundle is committed. No push, tag, publication or PR occurred.

Unconfirmed/unrun: the owner's post-merge status-click route; attribution or plugin-disabled reproduction of the historical launch hang; cause of the two intermittent full-run failures; later assertions blocked by the explicitly retained incompatible UI gates. Existing skipped tests were not force-enabled. Final exit codes: full E2E 1; lint 0; typecheck 0; i18n check 0; Jest 0; production build 0; extraction 0; final targeted native controls 0 and 0.
