# Round 7 E2E-2: integrated native-suite reconciliation

Date: 2026-11-06 (Australia/Melbourne).

**All twelve remaining cases now have passing reconciled coverage. All seven complete native files pass: 76 passed, zero failed/skipped/flaky, zero configured retries.** Product changes are limited to sentence-menu hover opacity and redundant collision-popover tooltip suppression; other changes reconcile or strengthen the existing tests.

## Candidate and isolation

- Branch: `redesign/r7-e2e2`; integration base: `2d56c088ab0392c87ca30f208367370b17ba769b`, containing both AA and E2E.
- The requested fast-forward failed because the initially clean checkout had unrelated main-history commits. The newly created branch was placed directly at `redesign/linear-in-obsidian`; the original `round7-e2e2-testing` branch was preserved. No existing work was discarded.
- `node_modules` links to `/home/calluma/projects/tasknotes-worktrees/.redesign/review-deps/node_modules` (calendar `0.1.7`, model `0.3.0-rc.18`). Runtime: `/home/calluma/projects/tasknotes-worktrees/plugin-redesign/.obsidian-unpacked`.
- Native Obsidian **1.14.2**, dedicated port **9499**, separate user-data profiles, `TASKNOTES_E2E_REUSE_OBSIDIAN=0`. Every launch verifies this checkout's `tasknotes-e2e-vault` over CDP. No normal Obsidian instance, other slice's port, push or publication was used.
- Evidence root: `/tmp/tasknotes-r7-e2e2/`. The copied section runner uses port 9499 and archives generated vault fixtures before removing them. Native configuration retries are zero (`CI` unset/empty); the individual runner additionally passes `--retries=0`.

Native reports' `source-sha.txt` records the base HEAD. Runs use the rebuilt working-tree patch committed with this report, not an assertion that the patch was already committed. This qualifies the supplied linked review dependencies, not a clean dependency installation.

## Twelve-case reconciliation

Case numbers retain the original inventory in `/tmp/tasknotes-r7-e2e/failures.json`. `alone/NN.json` refers to this slice's isolated run on the integrated base, before its fixes. Six cases fail there (21, 22, 23, 35, 36, 37); six already pass (24, 25, 26, 31, 33, 34). A passing old assertion alone does not prove the intended behavior.

| Case | Test | Classification on integrated source | Change and retained protection | Evidence |
| --- | --- | --- | --- | --- |
| 21 | `kanban-redesign`: default/eight custom statuses, both themes, desktop/400px | STALE | Require AA's intentional two-line title clamp, maximum two line heights, full title availability, no card overflow and centered metadata. Retain custom column/overflow checks and exact screenshot dimensions; remove the inherited screenshot retry wrapper. | `alone/21.json` fails; `reconcile/21.json` passes; final complete file below. |
| 22 | `presentation-round2`: both board date slots before chips | STALE selector | The broad span selector measured a hidden date label at x=0, not the displayed date. Select the visible `.task-card__date-value`; require containment inside the date control, its own slot **and** the metadata row. Both dates remain visible. No date-containment assertion is discarded. | `alone/22.json` fails; `reconcile/22.json` and complete file pass; inspected board-date screenshot. |
| 23 | `surfaces-redesign`: inline glyphs, dates and unknown values | STALE | Match both glyph dimensions to the shared 18px status-glyph token, not the generic 16px glyph. Distinguish intentionally minimal sentence references from full standalone widgets: custom/unknown icons remain attached, sentence metadata stays hidden, standalone custom priority and overdue date stay visible, blocked-value and touch-target checks remain. | `alone/23.json` fails; complete file below covers reading/live preview, both themes and narrow/desktop. |
| 24 | `task-list-redesign`: light aligned dates/chips/group actions/narrow layout | REAL, already resolved by AA | No assertion or product change for this case. Rerun the entire path, including overflow, date priority, group actions and narrow wrapping. | `alone/24.json` passes; complete file below. |
| 25 | `task-list-redesign`: dark equivalent | REAL, already resolved by AA | Same as 24; no weakened assertion. | `alone/25.json` passes; complete file below. |
| 26 | `task-list-redesign`: embedded Bases/native priority menu/selected timer task | REAL, already resolved by AA; strengthened coverage | The embedded overflow action is visible. In both themes at 1180/430px, open it using keyboard Enter and require every disclosed value, including the long tag, in the picker. Escape closes it, clears expanded state and returns focus to the shared Bases keyboard root. Preserve subsequent native priority-menu and selected-timer date/overflow checks. | `alone/26.json` passes; complete file below exercises the strengthened checks. |
| 31 | `calendar-composition-round7`: surfaces and real pointer states | REAL, timing-sensitive, not order-dependent | Reproduce the tooltip after its actual native delay. Suppress native tooltips only for collision-popover task rows with Obsidian's `--no-tooltip` boundary. Preserve accessible labels, row interactions, previews and ordinary calendar tooltips. Hover **every** popover row beyond startup delay; positive-control ordinary event tooltips in both desktop themes. | Original `alone/31.json` passes at 600ms; `tooltip-delay-repro/focused-01.json` fails with one tooltip at 1100ms; final complete file below. |
| 33 | `density-round4`: light mobile row composition | STALE premise | Replace status-beside-title geometry with AA's deliberate full-width title above actions. Require title equal to row width, status below title, all five 40px controls, no pairwise overlap, both dates visible, card under 110px and contained toolbar. Await actual date rendering before sampling geometry. | `alone/33.json` passes the old loose offset check; final complete file validates the new explicit contract. |
| 34 | `density-round4`: dark mobile row composition | STALE premise | Same full-width title, action reachability and date protection as 33. | `alone/34.json` passes; final complete file below. |
| 35 | `density-round4`: long custom labels/readable board titles | STALE | Retain full title text and accessible title attribute; require intentional two-line clamp and height bound rather than unbounded text. Long group-label wrapping/padding checks remain. | `alone/35.json` fails; `reconcile/35.json` and complete file pass. |
| 36 | `finish-round5`: 1180px light sentence reference | STALE + REAL | Static inline menu position is intentional. Keep menu opacity 1 at rest and hover, unchanged reference bounds, punctuation line-flow and width bounds; add actual keyboard menu opening. Fix the general card-hover rule overriding sentence-specific menu opacity with one existing-selector specificity correction. | `alone/36.json` fails; rebuilt complete file below covers all four viewport/theme variants. |
| 37 | `finish-round5`: 1180px dark sentence reference | STALE + REAL | Same static inline contract and opacity fix as 36. | `alone/37.json` fails; complete file below. |

No remaining case is classified ORDER-DEPENDENT merely because it sometimes passes. Case 31 has a demonstrated native delay explanation and a deterministic isolated reproduction.

## Tooltip root cause and controls

1. The original negative assertion dwells for 600ms. Read-only inspection of the installed Obsidian runtime shows its normal tooltip startup delay is **1000ms**. A zero count at 600ms is not reliable evidence of suppression; a previously warmed tooltip can also appear sooner.
2. The supplied calendar library mounts collision entries as `dot`/`bar`, not the `list` variant guarded in the decorator. It calls the decorator before attaching the item to the popover, so synchronous ancestor detection there would also miss the real mount path.
3. On the integrated plugin with no tooltip fix, all-row hover with 1100ms dwell fails alone: expected zero `.tooltip` elements, actual one. Trace and DOM evidence are in `tooltip-delay-repro/focused-01-artifacts/`. Its last recorded screencast frame, extracted as `visuals/tooltip-before.jpeg`, visibly shows the tooltip covering neighbouring popover rows. This is a scaled trace frame, not the post-cleanup screenshot.
4. A single custom property in the existing popover-row CSS rule disables native tooltip display in that surface, including inherited child tooltips, without removing `aria-label` or changing listener behavior. No library/vendor edit, asynchronous decorator, new component or dependency is introduced.
5. Final native coverage keeps zero-tooltip assertions after 1100ms on every row, confirms accessible labels remain, and requires an ordinary day-view event's full tooltip to appear in both desktop themes. Existing pointer, drag, cancellation and batch-selection checks remain.

The extra 500ms is a stricter negative-observation interval crossing the known native delay, **not** an increased assertion timeout or a retry. Test timeout budgets and expectation timeouts are unchanged.

## Complete-file discovery

The first complete-spec pass additionally exposed `kanban-redesign`'s neutral-surface geometry check. AA's `.task-card__title` is now a spanning wrapper, so comparing metadata against its bottom is stale. The failure reproduces alone in `extra-repro/focused-02.json`; measure the actual `.task-card__title-text` bottom instead. Preserve neutral header/lane surfaces, raised card contrast/border, metadata stacking, empty-lane height, card overflow and real narrow-pane horizontal scrolling.

The first pass also caught two new assertion setup errors: sampling mobile geometry before dates render, and expecting shared overflow-picker focus to return to its anchor instead of the documented Bases keyboard root. Both were corrected using actual render readiness/shared focus behavior, not sleeps, skipped assertions, timeout increases or retry loops. Preliminary `full-specs/` results are not final acceptance.

The first final-build calendar run passed popover suppression and ordinary-tooltip appearance, then failed the new positive control's cleanup because moving to `(5,5)` hovered Obsidian's **Expand** control and produced its tooltip. Moving to a calendar gutter instead also exposed an unrelated date tooltip (`final-calendar/`). Both error-contexts identify the new target's tooltip, not a leaked event tooltip. The positive control now moves outside the viewport, so it does not warm a second labelled control. The other six complete-file runs remain unchanged.

The focused `tooltip-control/` probe subsequently crossed the desktop control and narrow popover checks, but lost its owned page/browser during the existing narrow event-drag cancellation assertions. It exits 1 and is **not** a passing control run. Its profile log has no crash explanation, and current free memory/disk space do not establish a cause. The complete-calendar run under `qualified-calendar/` passes all eight tests and captures owned process stdout/stderr and exit events in `calendar-process.log` (normal exit code 0, signal null). The earlier interruption remains an unexplained diagnostic-run limitation, not attributed to a speculative product fix or silently counted as passing. All runs retain zero configured retries.

## Final validation

| Gate | Result | Evidence under `/tmp/tasknotes-r7-e2e2/` |
| --- | --- | --- |
| Final test-vault build | Exit 0 | `build-tooltip.log`; explicit `OBSIDIAN_PLUGIN_PATH` targets this checkout's isolated vault. |
| Strict lint | Exit 0 | `final-gates/lint.log`; all TypeScript, review-type, CSS and architecture stages run. |
| Typecheck | Exit 0 | `final-gates/typecheck.log`. |
| Translation preparation | Exit 0 | `final-gates/i18n-check.log`; catalogue contracts and source guards pass, no new messages. |
| Full Jest | Exit 0: 796 suites / 6121 tests passed; 68 suites / 988 tests inherited skipped; 4 inherited TODO | `final-gates/jest.log`; 7113 tests total, 164.841s. No skips added or tests weakened. |
| Production build | Exit 0 | `final-gates/build.log`; strict i18n preparation and Obsidian UI sink guard pass. |

Complete native specs, with actual JSON reports inspected rather than trusting the wrapper exit:

| File | Passed | Failed / skipped / flaky | Exit | Final report |
| --- | ---: | --- | ---: | --- |
| `calendar-composition-round7.spec.ts` | 8 | 0 / 0 / 0 | 0 | `qualified-calendar/focused-01.json` |
| `density-round4.spec.ts` | 12 | 0 / 0 / 0 | 0 | `final-native/focused-02.json` |
| `finish-round5.spec.ts` | 20 | 0 / 0 / 0 | 0 | `final-native/focused-03.json` |
| `kanban-redesign.spec.ts` | 15 | 0 / 0 / 0 | 0 | `final-native/focused-04.json` |
| `presentation-round2.spec.ts` | 12 | 0 / 0 / 0 | 0 | `final-native/focused-05.json` |
| `surfaces-redesign.spec.ts` | 4 | 0 / 0 / 0 | 0 | `final-native/focused-06.json` |
| `task-list-redesign.spec.ts` | 5 | 0 / 0 / 0 | 0 | `final-native/focused-07.json` |

Combined: **76 passed, zero failed/skipped/flaky**. `qualified-summary.json` is generated by an exit-0 verification script checking all seven process exits and report errors, zero project retries, every result's single successful attempt with retry index 0, and exactly one passing occurrence of each of the twelve original case IDs (including the two explicitly renamed mobile tests). The qualified calendar file takes 5.7 minutes; its pointer-state matrix stays within the existing 240-second test budget.

The first `final-native` batch exits 1 because its calendar positive-control cleanup hits Expand, as described above. Its calendar report is retained as development evidence, not counted twice or represented as a green run.

Final built files match the copies installed in the isolated vault:

- `main.js` SHA-256: `9404fab0115033f8c5a89816b7ae37dd09a77181cc70dc020961559498c12c4f`.
- `styles.css` SHA-256: `7d32af772806ebd2b8f7081165223451a3dbd9b7b436046f6d734fa7a8629dad`.

Inspected captures are archived under `visuals/`: sentence-reference light 1180px and dark 400px, neutral dark board, custom-status dark 400px board, dark 430px full-width mobile row, light 1180px board dates, embedded Bases light 1180px/dark 430px, and the recorded before-fix tooltip overlay. Calendar after-fix `{light,dark}-{1180,400}-popover-tooltip-dwell.png` captures show readable rows without an overlay after the final row's full native hover delay. The listed non-trace captures were inspected at their actual captured size after a successful final-source build; additional archived captures are not an additional visual-review claim.

Coverage is native desktop Obsidian with default light/dark themes and emulated narrow/mobile layouts. No physical mobile hardware, third-party theme, fresh lockfile installation or full native-suite rerun is claimed.

Tracked test-vault fixtures are restored, generated owned fixtures are archived outside the checkout, and port 9499 has no remaining listener. Only the scoped source/tests, this report and the two user-facing fix notes are committed. No push.
