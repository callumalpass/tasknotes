# Redesign round 3 acceptance

Date: November 5, 2026 (Australia/Melbourne).

**Outcome: not accepted as green.** Both requested file selections completed. The pinned published calendar still fails four redesign requirements, the rebased build reproducibly fails legacy rendering, and real intermittent fixture/Undo/interaction failures remain unconfirmed rather than waived. One deterministic Kanban refresh regression is repaired with native and unit coverage; stale specs retain their data and layout protections.

## Candidate and isolation

- Branch: `redesign/r3-accept`, created and fast-forwarded to the required merged tree, `75766475ce7b0404e52386883d8b0e51ee466aac`, before any edits.
- Initial dependency link: `/home/calluma/projects/tasknotes-worktrees/plugin-redesign/node_modules`, containing published `@tasknotes/calendar` 0.1.6.
- Second dependency link: `/home/calluma/projects/tasknotes-worktrees/.redesign/review-deps/node_modules`, containing the rebased unpublished calendar. **Both packages report version 0.1.6; version alone does not identify the implementation.** `dependency-provenance.json` records resolved paths and SHA256 digests of the ESM entrypoint and toolbar declarations.
- Native Obsidian 1.14.2, launched only by `e2e/obsidian.ts`, with reuse disabled, dedicated section profiles, debug port 9423, and this checkout's verified absolute test-vault path. Runtime: `/home/calluma/projects/tasknotes-worktrees/plugin-redesign/.obsidian-unpacked`.
- Reused the successful round-2 section inventory, adding the three new specs and splitting section 10. Every original spec appears exactly once in the full-run inventory: **203 files**. Fixtures were archived with byte-verified SHA256 digests between sections, then tracked vault state restored. The plugin was built with `OBSIDIAN_PLUGIN_PATH="$PWD/tasknotes-e2e-vault/.obsidian/plugins/tasknotes" npm run build:test` before each changed source/dependency build.
- Evidence root: `/tmp/tasknotes-r3-gates/`. Each run directory retains section logs, Playwright JSON, failure traces/screenshots, dedicated profiles, fixture archives and exit codes. `run.cjs` is the section harness; `summarize.cjs` produces `totals.json` and `failures.json`. Original observations are retained, not overwritten by reruns.
- No push, tag, publication, PR, dependency/lockfile change, hook bypass, lint weakening or `.ops/` commit.

## Raw results

Counts are independent runs, not deduplicated totals or claims that reruns erase initial failures. Playwright reported zero automatic retries/flaky outcomes in these runs; intermittent behavior was established by separate controls.

| Run directory | Files | Passed | Failed | Skipped | Total | Exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `published` — complete original merged tree | 203 | 499 | 18 | 820 | 1337 | 1 |
| `controls` — unchanged failure controls / known leads | 6 | 3 | 3 | 0 | 6 | 1 |
| `stale-fixed` — first spec repairs | 7 | 8 | 3 | 0 | 11 | 1 |
| `route-fixed` — corrected mobile row expectations | 4 | 3 | 2 | 0 | 5 | 1 |
| `touch-diagnostic` — pointer/edge-scroll evidence | 1 | 0 | 1 | 0 | 1 | 1 |
| `flag-diagnostic` — temporary DOM event instrumentation | 1 | 1 | 0 | 0 | 1 | 0 |
| `drag-final` — touch repair / uninstrumented locale control | 2 | 1 | 1 | 0 | 2 | 1 |
| `flag-source-diagnostic` — temporary console instrumentation | 1 | 1 | 0 | 0 | 1 | 0 |
| `flag-ring-diagnostic` — temporary in-memory instrumentation | 1 | 1 | 0 | 0 | 1 | 0 |
| `refresh-repro` — deterministic queued-refresh regression, before source fix | 1 | 0 | 1 | 0 | 1 | 1 |
| `refresh-fixed` — queued refresh, diagonal Undo, four-locale drag | 2 | 3 | 0 | 0 | 3 | 0 |
| `published-final` — whole changed/control files after source fix | 11 | 124 | 3 | 0 | 127 | 1 |
| `movement-final` — whole movement spec after bounds synchronization | 1 | 39 | 0 | 0 | 39 | 0 |
| `specs-final` — whole list and modal specs after synchronization repairs | 2 | 13 | 0 | 0 | 13 | 0 |

Final published changed-file sections and rebased-calendar sections are recorded below after completion. The 820 skipped tests in the full run are **not passed coverage**; suite opt-ins/manual, provider/device and explicitly skipped issue scenarios remain unconfirmed. All 203 files were inventoried and collected, not all 1337 tests executed.

## Confirmed source regression and repair

`KanbanView.debouncedRefresh()` could execute a queued appearance/task refresh after a native drag began. `onDataUpdated()` already deferred active drags, but this timer path did not. Redrawing detached the source element and discarded the native drop. Debug logging sometimes changed timing enough to hide the failure, so diagnostic passes were not accepted as the repair.

The new native regression starts a real drag, triggers the workspace `css-change` event, and waits 250 ms to exercise the existing 150 ms debounce (not a larger assertion timeout). Before the fix, the original dragged element becomes disconnected. After the fix it remains connected and the drop persists the exact target status and priority. The normal cleanup and board-state assertions still execute.

The minimal source change defers the timer when `draggedTaskPath` is set, marks `pendingRender`, and clears its timer reference. Existing dragend handling schedules the deferred render; the existing in-flight-drop guard still protects writes. A focused Jest regression verifies no render during the drag and one render afterward, including scroll-state restoration. A user-facing unreleased note describes this fix. All temporary diagnostic instrumentation was removed.

## Every original failure

Line numbers identify the original merged tree. No failed protection was disabled or skipped to manufacture a green run.

| # | Spec / test | Verdict, evidence and action |
| ---: | --- | --- |
| 1 | `calendar-design.spec.ts:136` — public view buttons across themes/narrow panes | **Real unmet published-library acceptance.** Published 0.1.6 has no compact `.tnc-toolbar-view-select`; selecting a narrow view times out. The required assertion is unchanged. |
| 2 | `calendar-design.spec.ts:305` — empty agendas | **Real unmet published-library acceptance.** Published 0.1.6 renders `Nothing scheduled`, not the plugin's custom empty content/New action. The required assertions are unchanged. |
| 3 | `interaction-layer.spec.ts:222` — unconfigured/unmatched/empty priorities | **Stale spec.** The redesign intentionally removed the duplicated detail label. Assert the selected option's exact accessible name `high (not configured)` and `aria-selected=true`; retain empty and unmatched-state checks. |
| 4 | `issues/issue-2381-task-movement.spec.ts:390` — narrow dark touch parent drop | **Stale viewport setup.** Taller mobile rows put the parent target against the viewport edge. Pointer evidence shows edge autoscroll moved it between the screenshot/move and release; the same release hit a task row. Scroll the actual parent target into view before measuring it. Retain visible feedback, minimum 44px target, screenshot, exact single parent write and status/priority/order checks. Repaired control passes. |
| 5 | `kanban-redesign.spec.ts:202` — diagonal native drop and Undo | **Real intermittent drag failure, consistent with the queued-refresh race.** Unchanged isolated control passed; deterministic refresh reproduction established the race. Source guard and new regression cover that mechanism, without rewriting this test's exact two-axis Undo/unrelated-edit assertions. The original failure cannot be retroactively attributed with certainty. |
| 6 | `lingui-bundled.spec.ts:159` — en/it/de/ru group identities | **Real intermittent drag failure.** Repeated uninstrumented controls delivered native drag/drop events but left raw `review_flag=false`. Instrumented controls sometimes passed, so neither offsets nor logging was kept as a fix. After the queued-refresh guard, the unchanged four-locale test passes with exact boolean writes, empty-property removal, creation and saved column-order checks. |
| 7 | `modal-round1.spec.ts:65` — create shortcut from every chip/footer control | **Real intermittent acceptance failure; cause unconfirmed, not stale.** Initial Meta+Enter control left a fresh empty modal with disabled Create. The unchanged isolated control passed. No source/spec change or weakened shortcut assertion is used to hide this observation. Final whole-file result must be considered alongside the original red result. |
| 8 | `secondary-round2.spec.ts:85` — atomic reading/live-preview references | **Stale mobile layout spec / Slice N lead.** Mobile intentionally stacks title, metadata and grouped actions. Keep the same `<24px` action-row bound, add strict title-before-metadata-before-actions order, retain desktop all-elements bound, card count, width and inline display checks. Repaired reading/live-preview control passes. |
| 9 | `surfaces-redesign.spec.ts:173` — reports/releases/settings | **Stale layout spec.** Shared metrics intentionally use CSS grid. Assert exact grid rather than obsolete flex; retain report/theme/mobile protections. |
| 10 | `task-list-redesign.spec.ts:37` — light narrow list | **Stale presentation spec.** Mobile titles wrap; touch menus stay visible; both date slots remain visible on separate rows. Assert exact visible due/scheduled labels, zero hidden/two visible slots, focusable overflow, strict overflow limit, and bounded 170px layout instead of old desktop-like hidden metadata. |
| 11 | `task-list-redesign.spec.ts:37` — dark narrow list | **Stale presentation spec.** Same repair and unchanged data/overflow bounds as #10, exercised in dark theme. |
| 12 | `task-list-redesign.spec.ts:210` — embedded bases/native menus/timer | **Stale visibility assumption.** Even a desktop window can host a narrow task selector. Use the actual slot's `hidden` state, requiring either visible date or its exact accessible label in the overflow summary; do not assume all desktop-width dates are visible. |
| 13 | `task-modal.spec.ts:87` — form follows raw text/removal | **Stale route to hidden NLP editor.** Expanding details now hides NLP. Return to collapsed mode before typing; normalize create-helper disclosure state. Keep parsed title/date and removed-text restoration assertions. |
| 14 | `task-modal.spec.ts:107` — manual edits win over later NLP | **Stale route to hidden NLP editor.** Explicitly return to NLP after detailed-title edit; keep exact manual-title precedence assertion. |
| 15 | `task-modal.spec.ts:121` — text beside prefilled title | **Stale inherited disclosure state.** Start create in collapsed NLP mode; keep the original saved data/title assertions. |
| 16 | `bugs-round3.spec.ts:202` — theme date contrast/overrides | **Stale synchronous timing.** A CSS transition exposes an intermediate `oklab(...)` color. Retry the identical exact RGB expectation with `toHaveCSS`; keep all original contrast thresholds (including 4.5:1) and theme override assertions. |
| 17 | `narrow-reading-round3.spec.ts:132` — compact calendar navigation/actions | **Real unmet published-library acceptance.** Same absent compact selector as #1; assertions unchanged. |
| 18 | `narrow-reading-round3.spec.ts:164` — collision widths/timed/deadline lines | **Real unmet published-library acceptance.** Published 0.1.6 lacks collision-column layout metadata/behavior required by this test (`--tnc-collision-columns` reads zero). Keep the `>=3` collision/data and line-fit checks unchanged. |

The remaining failures in intermediate runs are repeats of the rows above: `stale-fixed` still had #8/#10/#11 before the final mobile assertions; `route-fixed` and `drag-final` still exposed #4/#6; `touch-diagnostic` deliberately retained the failing release/write; `refresh-repro` adds the deterministic source-detachment failure described above. Their raw failures remain in each run's JSON.

The whole-file `published-final` rerun found three further spec synchronization issues, retained as raw failures rather than hidden by targeted-only results:

| Test | Verdict and action |
| --- | --- |
| Movement: parent assignment honors Markdown frontmatter links | **Stale non-retrying geometry read.** After the first exact parent write, the list can redraw before the second drag's `boundingBox()` read. Retry the same non-null source-bounds assertion before starting the gesture. The final whole movement file passes all 39 tests, including exact Markdown-link format, single relationship, and already-a-subtask feedback. |
| Timer: embedded bases/native menus/selected task | **Stale resize synchronization.** The initial `hidden` branch can change during ResizeObserver processing. Retry the complete visible-date-or-focusable-exact-label assertion together within the existing 5000ms budget; retain at least one visible date and the 1px overflow bound. |
| Modal: time estimates accept durations/reject other input | **Test-setup interaction introduced by the collapsed create-helper repair.** Explicitly expand detailed fields after entering the title before accessing the estimate input. Preserve invalid input feedback/no saved task, valid `1h` conversion and exact saved `60` minutes. |

## Known leads and preservation checks

- **Postpone:** `undo-round2.spec.ts`'s action button is now scoped to `.modal`, avoiding ambiguity with an identically named Base/view button. The original full run and unchanged control passed; this is a stale-locator hazard, not a claimed reproduced product defect. Exact two-task writes and Undo restoration remain asserted.
- **Status click:** the existing interaction suite clicks list and Kanban status dots, requires the picker to be hidden, checks the exact next configured status, and restores it with Undo. The keyboard `s` picker path remains separate. No status-click source behavior was changed.
- **Both calendar implementations:** `secondary-round2.spec.ts` previously identified its fallback by version `0.1.6`; that also matches the unpublished rebased package. It now selects the existing strict branches using the installed public `listEmptyContent` declaration. This does not skip the unconditional strict redesign tests in `calendar-design` or `narrow-reading-round3`.
- No calendar package/vendored output was edited and no private host-toolbar workaround was added. Published and rebased packages are tested separately; passing the rebased package cannot establish acceptance of the pinned published dependency.

## Final validation and limitations

- Final source gates on the published dependency: lint **0**, typecheck **0**, `i18n:check` **0**, full Jest **0**, production build **0**. Logs: `checks-final/`. Full Jest: **789 passed suites, 68 skipped; 6067 passed tests, 988 skipped, 4 todo (7059 total)**. The initial merged-tree gates also all passed (`checks/`), with 788 passed suites and 6066 passed tests before adding the queued-refresh unit regression.
- The focused queued-refresh Jest test passes separately (`queued-refresh-jest.log`). Initial, diagnostic and repaired published `build:test` builds pass. The rebased build's exit is recorded separately in `rebased-build-exit.txt`.
- All eleven files selected for the `published-final` series have passing whole-file followups after the three synchronization repairs: the original run remains 124/3, followed by 39/0 for movement and 13/0 for list/modal. This excludes the intentionally red calendar requirements. No aggregate full-suite green result is claimed: the full 203-file run was on the original merged tree, followed by whole-file affected-surface reruns after repairs.
- The original create-shortcut failure remains an unexplained intermittent observation despite unchanged isolated and whole-file controls passing. The original diagonal-drop failure is consistent with the proven refresh race but was not instrumented at the time; exact historical attribution is not claimed.
- Narrow/mobile cases use Obsidian viewport/touch emulation, not physical iOS/Android hardware. No provider credentials, opted-out scenarios, installed third-party themes, or unsupported skipped tests are claimed verified. Local traces/screenshots are diagnostic artifacts, not a release attestation.

## Rebased run recovery evidence

The calendar selection is 88 whole spec files: every named calendar/agenda/mini-calendar file plus mixed-surface files mentioning those features. These runs are independent observations, not combined into a synthetic green result.

- `rebased/`: interrupted with exit 143 before the first 12-file section completed. Console reported 51 passes and two failures, with no final JSON. Drag/resize read a temporarily absent event bounding box after the exact scheduled-date write; the spec now retries that same non-null geometry before resizing, preserving exact scheduled time and 120-minute duration. The legacy grouped-settings spec expected two visible events and received one; its rendering/data protections remain unchanged.
- `rebased-complete/`: background bootstrap ended before testing; no results, not acceptance coverage.
- `rebased-sectioned/`: 35 files collected, **22 passed / 6 failed / 221 skipped (249 total)** before interruption. Three behavioral failures were partial group Undo (Alpha not restored), keyboard group movement (Bravo not moved), and the timeblock view-preference save remaining `listWeek` instead of `timeGridCustom`. None of these exact data assertions was edited. The other three failures were startup infrastructure: grouped-settings beforeAll timeout, docs screenshots debug-port collision (two attempts), and issue-1004 debug-port collision. Calendar engine passed all six cases after the geometry repair.
- `rebased-final/`: stopped after four completed file sections, **0 passed / 4 failed / 22 skipped (26 total)**. All four failures were beforeAll startup timeouts (calendar batch, design, engine, settings); the fifth file was interrupted. Trace initially appeared to implicate the broad Trust fallback, but `/proc` and `ss` established an older owned Obsidian process still listening on 9423 after SIGTERM. New profiles were connecting to that stale instance. Only the exact owned profile/process groups were killed; no product or trust-locator change was made on that theory.
- The external section driver's cleanup now escalates SIGTERM to SIGKILL for those exact owned groups after its existing one-second grace period. `startup-control/` then passed **6/0**, exit 0, on a fresh isolated calendar-engine profile. This is infrastructure recovery, not evidence that the earlier behavioral failures were stale.

Shared review-dependency drift was also checked: the package CSS changed and five unused ESM chunks disappeared during the run, outside this checkout. The ESM entrypoint, active JavaScript chunks, CJS and public types remained unchanged. TaskNotes builds from its vendored calendar CSS rather than that package CSS. `rebased-bundle.sha256` records the actual fixed built plugin/vault bundle (`main.js` SHA256 `55cd5e69863c84dee43b7f1075d0d1f435883e1cc4c953450a506a314a68847a`). No claim is made that the entire shared dependency directory was immutable.

## Completed rebased acceptance

`rebased-clean/` completes all **88 files / 752 tests: 287 passed, 4 failed, 461 skipped, 0 flaky**, exit **1**. All sections completed; skipped cases are not verified coverage. Compact calendar selectors, custom empty agendas, collision layout, mini-calendar drilldown, the complete 13-case calendar batch suite, timeblock view persistence, and the strict round-three narrow cases pass on this build. This does not make the published build accepted.

| Failure | Verdict and preservation |
| --- | --- |
| `calendar-design.spec.ts:213` — dense recurring days retain readable titles and every overflow item | **Real intermittent acceptance timeout, cause unconfirmed; not stale.** The 60-second test timed out during fixture creation before reaching the 35-item overflow checks. The unchanged fresh control passes in 2.0 seconds and verifies all 35 entries. No timeout, fixture count, recurrence, or overflow assertion was changed. The initial timeout remains part of the acceptance result. |
| `calendar-settings.spec.ts:11` — legacy calendar keys keep their rendering when opening grouped settings | **Real reproducible compatibility failure on the rebased build.** Expected two visible events, got one. It fails both the complete run and unchanged fresh control (as well as the earlier interrupted attempt). The exact event/more counts, three-day headers, width ratio, settings values, unchanged source YAML and reopen geometry protections remain intact. The initial count failure prevents confirming the later settings/no-rewrite assertions. No dependency edit or private host workaround masks it; root attribution between the rebased library/layout and host remains unconfirmed. |
| `secondary-round2.spec.ts:85` — inline references remain atomic in reading and live preview | **Stale one-shot geometry synchronization.** After a leaf/theme/mobile change the one-shot metadata computed style was empty rather than `flex-start`; the unchanged fresh control passes. Retry the complete geometry assertion together within the normal 5000ms assertion budget and require connected cards. Keep both cards, exact display/alignment, 1px overflow bound, 24px row bound, strict mobile row order and every theme/viewport/mode combination. |
| `undo-round2.spec.ts:112` — calendar single all-day conversion, timed move and resize restore disk files | **Real intermittent acceptance failure, cause unconfirmed; not stale.** Undo left `scheduled: 2026-11-06T13:00` instead of the exact `09:00` snapshot, and the UI reported `Cannot undo: the note has changed.` The unchanged fresh control passes all conversion/move/resize disk snapshots. No receipt guard, data equality, body/property protection, or timeout was weakened. A successful control does not establish why the original receipt was rejected. |

`rebased-controls/`: **3 passed / 1 failed**, four files/four selected tests, exit **1**. Dense, inline and single-task calendar Undo pass unchanged; legacy settings remains red. The earlier partial group Undo, keyboard group movement and timeblock preference failures remain real intermittent observations with unconfirmed causes; their exact assertions pass unchanged in the complete clean run, not subtracted from their original run totals.

## Final reruns and handoff

| Run directory | Files | Passed | Failed | Skipped | Total | Exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `startup-control` — rebased calendar engine after owned-process cleanup | 1 | 6 | 0 | 0 | 6 | 0 |
| `rebased-clean` — complete calendar/agenda/mini-calendar selection | 88 | 287 | 4 | 461 | 752 | 1 |
| `rebased-controls` — unchanged fresh failure controls | 4 | 3 | 1 | 0 | 4 | 1 |
| `rebased-secondary-final` — whole secondary spec after coherent geometry retry | 1 | 6 | 0 | 0 | 6 | 0 |
| `published-calendar-final` — whole calendar design, engine, secondary and narrow-reading files | 4 | 20 | 5 | 0 | 25 | 1 |

The last published run used a rebuilt vault bundle after restoring the published dependency link; `published-final-build:test` exits **0**. Both recently changed whole files pass on published 0.1.6: calendar engine **6/0**, secondary **6/0**. Its five failures are the same four unresolved published-library requirements from original rows #1, #2, #17 and #18, plus the dense-recurring fixture timeout from the rebased run. The latter therefore affects both dependency builds intermittently; it is not attributed solely to the rebased library, and its 60-second timeout and all 35-item protections remain unchanged. No additional source fix is claimed for that unconfirmed cause.

Quality gate exit codes are **E2E 1, lint 0, typecheck 0, i18n check 0, full Jest 0, production build 0**. The final E2E-only geometry synchronization change does not alter the source/unit candidate checked by `checks-final`; all strict gate logs remain available there. Build-test exits are separately recorded for both implementations. No red assertion was skipped, data equality weakened, limit widened, receipt guard bypassed, or dependency edited to achieve these results.

The tracked vault is restored with the requested checkout command and generated Views cleaned with the requested scoped clean. Generated untracked fixtures are retained in byte-verified archives outside the repository. The dependency link is restored to `/home/calluma/projects/tasknotes-worktrees/plugin-redesign/node_modules`; debug port 9423 has no listener. `git diff --check` passes. Only the intended source, native/unit tests, unreleased fix note and this report are staged for the local acceptance commit; no `.ops/`, fixture, dependency or lockfile changes are included.

Still unconfirmed: the causes of intermittent create-shortcut, group Undo, keyboard group movement, view-preference save, dense-fixture performance and single-task guarded Undo failures; the later grouped-settings/no-rewrite assertions blocked by the rebased event-count failure; all opted-out/skipped provider/device scenarios; and physical-mobile behavior. Passing controls are evidence of intermittency, not an erasure of these failures or permission to publish.
