# Round 7 — Slice X: mobile and remaining findings

## Candidate and scope

- Branch: `redesign/r7-mobile`; integration base: `92a7520de` (`redesign/linear-in-obsidian`).
- The original checkout could not fast-forward to that integration branch because it contained unrelated main commits. The new branch was instead recreated directly at the requested integration base; the original branch was preserved.
- `node_modules` links to `/home/calluma/projects/tasknotes-worktrees/.redesign/review-deps/node_modules`. The linked, unreleased calendar build is an intentional prerequisite, not a published dependency upgrade. The tracked vendor tree is unchanged.
- The pinned Round 7 brief, Round 3 Common rules, Round 4 Additions, and incumbent shared UI are the design authority for this implementation sub-agent. No new visual system, dependency, or compatibility layer was introduced.
- Native validation uses `e2e/obsidian.ts`, isolated Obsidian 1.14.2, distinct profiles, reuse disabled, and debug port **9493**. Each launch verifies this checkout's test vault. Nothing targets the user's normal instance.

## Item-by-item outcome

| Item | Outcome | Reproduction, implementation, and evidence |
| --- | --- | --- |
| 1. Mobile hit areas | Done; some inherited fixes already present | Baseline board controls measured 24px wide and as little as 20.22px high. List, agenda, inline, and mini-calendar controls in the baseline fixture already measured at least 40px. Corrected board date selectors, menu sizing, and shared mobile override specificity while retaining small glyphs. After measurements are at least 40px in both themes. Native CDP touch starts **4px above** list and board status glyphs change status, never open Edit, and Undo works. Pairwise control-overlap checks cover list, agenda, board, and standalone widgets. |
| 2. List/agenda rhythm | Done | One full-width wrapped title, one 40px action row, then compact wrapping metadata. Both dates remain visible at 400px and 430px, including scheduled time (agenda retains its time stamp). The list fixture's long title gets the entire 300px card content width; its main grid measures 98.38px including metadata. Extra metadata can legitimately add lines rather than disappear. Final visual review caught higher-specificity agenda overrides breaking the shared grid despite the earlier tests passing. Removed those mobile overrides, bounded date controls to their slots, and strengthened geometry tests to require title bounds, one action row below it, and metadata below the actions. |
| 3. Native settings | Done | Marks the actual native settings host and queries the content container, not the whole application viewport. Removes nested native wrapper padding/margins/borders and stacks controls at narrow container widths. Labels wrap at words. At a 400px native window, the plugin root measures 188px with zero padding; Obsidian still owns the sidebar. Host class is removed when settings close. |
| 4. Standalone widgets | Done | Container-scoped title/actions treatment gives the title the full width and retains both dates without unnecessary truncation. Sentence-reference CSS and behavior are intentionally unchanged. Before/after screenshots include both variants together as a control. |
| 5. Batch/help | Done | All shared property-picker families receive the selected-task count heading. Help includes Mod+Z Undo; the task context menu invokes the existing active view's help control. Native tests open a two-task picker and reach help through the menu. |
| 6. Toast wording | Done | Shared localized movement message states the action, count, and configured destination. Real mouse multi-drops on list and board produce **Moved 2 tasks to In progress — council** and preserve Undo. Property feedback includes the affected count. Configured list status/priority labels resolve through field mappings rather than raw values, including `note.`/`task.` prefixes. |
| 7. Invalid dates | Done | Quick picker and precise natural-language input show inline role-alert errors with `aria-describedby` and `aria-invalid`. The natural-language error stays until the text parses successfully; Enter returns focus to that input, not a remote Notice. Both invalid persistence and correction are exercised in light/dark. |
| 8. Failed writes | Done | Failed property or movement writes offer Open task; partial successes retain their Undo receipt. Shared toast recovery is a secondary action, not a new Undo-history entry. List multi-drop failures aggregate instead of being overwritten by the final success toast. Native injected write failures verify the recovery route, and a unit test protects Undo history when recovery is used. |
| 9. Calendar defaults | Done | Appearance settings explicitly describe fallback defaults and direct existing-view changes to the Base's view settings. All ten locale catalogs are translated. No existing Base is migrated or overwritten. |
| 10. Column navigator | Done | Narrow boards show previous/current/next navigation with configured column labels and live counts; current selection follows horizontal scrolling. Native select preserves keyboard operation; boundary buttons are disabled, single-column navigation is hidden, and reduced motion is respected. Horizontal scrolling remains available. |
| 11. Full modal labels | Done; existing accessibility retained | Property chips already had full accessible labels/tooltips and opened full-label pickers. Their visible label elements now also retain the complete text as a native title. The additional narrow-modal regression uses a long configured label, closes the picker with Escape, verifies focus returns to the chip, and confirms cancelling the modal leaves the task file unchanged. |
| 12. Two flaky tests | Geometry cause reproduced/fixed; settings focus hardened | The timed-event failure was reproduced: a calendar refresh between separate asynchronous geometry reads made `boundingBox()` return null. Wait for the selected day/header and read all title/time geometry atomically within a retrying assertion, preserving width, clamp, visibility, and non-overlap checks. The historical settings-focus failure did **not** reproduce here; its helper lacked the shared settings helper's `bringToFront()` handoff. Added that handoff and persisted restored settings in teardown to prevent later-suite contamination. Window-activation race is an inference, not a proven historical root cause. |

## Ownership crossings and retained functionality

- `TaskListView.ts`: configured movement labels, count/outcome wording, and aggregate failed-write recovery only. No desktop drag mechanics or rest/hover/selection redesign.
- `KanbanView.ts`: narrow navigator and count updates, movement wording, failed-task route, and navigator cleanup only. Existing drag previews, insertion behavior, and settle treatment are retained.
- Shared card/list styles: mobile-only layout and hit areas. Removed 60 lines of competing mobile list overrides so list and agenda use one card contract. Desktop list appearance stays with its owning slice.
- `styles/bases-calendar.css`: removed only the competing mobile card overrides; desktop agenda composition and the mobile time stamp remain unchanged. This necessary calendar-owned crossing fixes Slice X item 2 rather than redesigning calendar rendering.
- `taskViewKeyboard.ts`: adds Undo to existing help, without another shortcut handler. Shared picker/toast changes reuse existing overlay and mutation paths.
- Deliberate test update: the mobile drag handle now shares the action row instead of sitting underneath status; the old assertion was stale even on the merged baseline. Replacement checks retain non-overlap and alignment intent. Calendar geometry assertions are strengthened with an atomic rendered-state snapshot, not skipped or weakened.
- Nothing is removed: dates, metadata, overflow actions, horizontal board scrolling, keyboard help, configurable workflow values, and Undo remain reachable. Very long titles/metadata can still require additional height. Sentence references retain their existing compact-reference implementation, including its inherited wrapping limitations.

## Visual and state evidence

Root: `/tmp/tasknotes-r7/mobile/`. Before/after images cover light/dark at **1180×900** and **400×900**, for list, agenda, board, mini-calendar, standalone/sentence widgets, task modal, and native settings, with one explicit baseline gap: `before/dark-1180-modal.png` captured the context menu rather than the modal and has incorrect native dimensions. The modal sheet labels that slot unavailable instead of presenting it as valid modal evidence. All 87 final after PNGs have the requested dimensions. Existing narrow regressions additionally cover 400px and 430px.

The fixtures were expanded for multi-selection and use different configured workflow labels/counts in some later captures; these are layout/interaction comparisons, not pixel-diffs of identical data.

Selected after images:

1. `/tmp/tasknotes-r7/mobile/after/light-400-list.png`
2. `/tmp/tasknotes-r7/mobile/after/dark-400-agenda.png`
3. `/tmp/tasknotes-r7/mobile/after/light-400-board.png`
4. `/tmp/tasknotes-r7/mobile/after/light-400-inline.png`
5. `/tmp/tasknotes-r7/mobile/after/light-400-date-invalid.png`

Labelled contact sheets are `/tmp/tasknotes-r7/mobile/states-{list,agenda,board,mini,inline,settings,modal,pickers}.png`. Before frames are **rest-only**; after frames distinguish real pointer hover, keyboard focus, touch-held press, disabled navigation, batch selection, date errors, failed writes, and held multi-drag/drop-settle where applicable. They do not imply missing before-state interaction captures exist.

State coverage is slice-scoped: actual list/board multi-drop and Undo, touch status/Undo, keyboard pickers/help and focus return, invalid/corrected text, failed writes, navigator scrolling/boundaries, long and short titles, missing metadata, and configured/unknown workflows. The existing combined regressions additionally exercise unknown-value settings recovery, timed-event collision geometry, date priority, and neighbouring board columns. Desktop drag cancellation, invalid drops, exhaustive auto-scroll, every archived/blocked/completed combination, all native themes, screen-reader output, physical mobile devices, and a complete Cartesian state matrix were **not** independently requalified by this slice. Mouse hover captures under `body.is-mobile` are not proof of physical touch hover behavior.

## Validation

- `npm run lint`: exit 0, including strict TypeScript/review-types, CSS, and architecture gates.
- `npm run typecheck`: exit 0.
- `npm run i18n:check`: exit 0, catalogs and source guards; real translations in all ten locales.
- `npm test -- --runInBand`: exit 0; **794 suites passed, 68 skipped; 6,103 tests passed, 988 skipped, 4 todo**. Existing skipped/todo tests were not enabled or weakened.
- `OBSIDIAN_PLUGIN_PATH="$PWD/tasknotes-e2e-vault/.obsidian/plugins/tasknotes" npm run build:test`: exit 0; rebuilt plugin copied to the verified isolated test vault.
- `node --test scripts/calendar-css.test.mjs`: initially exit 0; **latest exit 1 after the shared dependency changed during validation**, as explained below. No pin or vendor file was weakened to conceal this.
- Mechanical Impeccable detector: exit 0, no findings (`design-detect.json` and final `design-detect-closeout.json`).
- Combined native run after the final standalone-date layout fix: **23 passed**, exit 0 (`e2e-final3.log`). With the additional long-label regression and the updated collision-count contract: **24 passed**, exit 0 (`e2e-final5.log`). Final repeated-flake and screenshot-dimension checks are recorded in the closeout below.

### Shared calendar dependency drift

The shared `review-deps/node_modules/@tasknotes/calendar/dist` was replaced during this run (observed at 03:25 local time on November 6, 2026). The subsequent rebuilt candidate exposed a stale existing assertion: collision count text is now `8`, while the button's accessible label still contains `8 appointments, …`. The first combined run against it had **23 passes / 1 failure** (`e2e-final4.log`). Updated that assertion to require both the numeric count and the full accessible appointment label; the next combined run passed all 24 tests. This follows the new library contract without weakening the appointment-count or drilldown intent.

The same external change makes the CSS pin check fail: expected upstream SHA-256 `684254a7639603fcafe3a6a8bf69916a0880ae103a92ee317262ed1df4cfb06e`, first observed replacement `8431bfcc29e8bc712ddfaeb181903250199d68bfa19d0e6fc69d173aa79729a9`, and final observed replacement `7a8718d851179e21d9a6a68bc59ccab96a74247c7d1ffa987594d707ac2556f5` (`calendar-css-closeout.log`, exit 1). The package still declares 0.1.7. The shared calendar owner must integrate its new engine stylesheet and the corresponding reviewed host adaptations/pin; this mobile slice does not overwrite their concurrent library work or simply accept a new hash. Final linked CSS and JavaScript digests are recorded in `/tmp/tasknotes-r7/mobile/calendar-closeout.sha256`.

This is an explicit integration blocker for a clean pinned-engine gate, not a mobile implementation failure or a clean-release claim.

### Final closeout

- The two specified flaky tests each pass **four consecutive repeats**: eight passes, exit 0 (`e2e-repeat.log`). The original settings failure remains unproven; repeated success is not a historical root-cause claim.
- The final nine-test mobile suite passes, exit 0 (`e2e-native-final.log`), including real list/board touch above the glyph, multi-drop count/configured-label feedback and Undo, long modal labels with draft-safe cancellation, non-overlapping mobile controls, navigator boundaries, and the full theme/width capture matrix.
- Screenshot capture now asserts both the native content size and the PNG dimensions. The host compositor ignored some earlier native resizes; the Settings window also has a 600px native minimum. Final capture runs in a private **1400×1000 Xvfb display**, lowers the minimum size only on its own isolated test windows, and captures exactly the requested viewport rectangle. A hidden Markdown editor mirror is excluded from hover/overlap targets. The earlier failed capture-only probes are retained as diagnostics, not represented as passing tests or final evidence.
- Final full Jest after the shared library replacement still passes all 794 enabled suites / 6,103 tests (`jest-final4.log`). Strict lint, typecheck, i18n and production/test build all exit 0; the external calendar CSS pin gate remains exit 1 for the documented hash mismatch.
- The final agenda correction passes the combined **24 native tests**, exit 0 (`e2e-closeout2.log`); the full Jest rerun again passes **794 suites / 6,103 tests**, exit 0 (`jest-closeout.log`). `build-closeout.log`, `lint-closeout2.log`, `typecheck-closeout.log`, and `i18n-closeout.log` record the final source gates. Agenda contact sheets were regenerated and both full-size mobile themes inspected after correcting the cascade.
- One intermediate combined run exposed another focus race in the failed-write regression: separate `focus()` and page-wide `keyboard.press('s')` calls straddled a card refresh; the trace snapshots show the focused status element replaced before the key. The control case with the same failure injection had passed in preceding runs. Changed both status-shortcut entries in that spec to locator-scoped `press('s')`, which focuses the current control in the same action; all failure-message and unchanged-file assertions remain. The next combined run passes. Preserved evidence: `failure-evidence/property-focus.trace.zip` and `property-focus-snapshots.jsonl`; the timeout was at the absent Stage 0 option, before the injected write, not a persistence regression. This reproduced test-input race does not prove the separate historical settings-focus failure had the same cause.
- Final repeated qualification covers configured-status keyboard input, failed-write recovery, unknown-priority settings focus, and collision geometry **four times each: 16 passes**, exit 0 (`e2e-repeat-closeout.log`).
- The test vault's tracked appearance/settings fixtures are restored, the owned generated statistics Base is removed, no owned `MobileR7-*` folders remain, and port 9493 is closed. No normal Obsidian instance was reused. No push or publication is performed.

Logs, measurements, screenshots, and explicitly preserved failure traces stay outside the commit under `/tmp/tasknotes-r7/mobile/`; other Playwright traces in its ignored result directory may be overwritten by later runs. This is implementation qualification against the intentionally linked calendar build, not publication or release qualification.
