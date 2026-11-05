# Round 7 AA implementation report

Date: November 6, 2026. Plugin branch: `redesign/r7-council3`.
Baseline: `be09f807c` (`redesign/linear-in-obsidian` at task start).
Scope: the nine findings in `ROUND7AA.md`, following the common Round 3/4/7 rules.

## Per-item outcomes

1. **Done — mobile task composition.** List, board, agenda and selected-day cards
   share a full-width title and a compact control/date row, followed by metadata.
   Passive details icons no longer reserve a 40px row. Interactive targets remain
   distinct and at least 40px. Metadata uses the existing overflow disclosure;
   configured values are not discarded. The native regression measures target
   rectangles and checks pairwise non-overlap on each surface.
2. **Done — desktop board indicator baseline.** A shared CSS subgrid puts details,
   relationships and metadata on the same baseline instead of an intervening
   icon-only line. The existing overflow action remains at the end of the
   metadata area, with existing labels and actions intact.
3. **Done — sentence references.** Sentence widgets use real inline layout,
   allowing the task title to wrap with surrounding prose. Their menu is static
   in the text flow, not absolutely positioned over the next line. Native checks
   assert inline layout, containment within the paragraph, and keyboard opening
   and dismissal of the menu. Standalone widgets retain the separate card layout.
4. **Done — settings disclosures.** The common collapsible-card component now
   creates native buttons with `aria-expanded` and `aria-controls`. Collapsed
   content and footer actions are both `hidden` and `inert`; closing a section
   containing focus restores focus to its disclosure. Enter and Space toggle it,
   and focus-visible has an explicit ring. Property reveal still focuses the
   actual field, not the new header button. This applies to every caller of the
   shared collapsible-card component, with unit coverage for common behavior and
   native coverage of Task properties. The native test also checks that Obsidian
   does not impose a filled generic-button background on the disclosure.
5. **Done — full mobile date values.** Agenda and selected-day rows no longer
   squeeze dates beside a narrow title column. Date icons sit above complete
   labels in their own 40px controls; measured label scroll widths fit their
   visible widths. Both scheduled and due dates remain present.
6. **Done — narrow Month overflow.** The calendar library displays `+N` in narrow
   day cells while preserving its localized full accessible label and existing
   drilldown. Native checks verify the count fits, its accessible name, and
   opening/closing the popover. A library browser test covers the 400px case.
7. **Done — calendar row grid.** Desktop agenda and selected-day entries retain
   their stamp column even when empty, using one 16ch width across event types.
   This aligns all-day, deadline, timed and tracked-entry titles. Mobile stamps
   move above the full-width card rather than narrowing its title and metadata.
8. **Done — held-gesture tooltips.** A view-owned observer dismisses existing
   tooltips when the engine enters a drag/resize, suppresses tooltips while held,
   and clears suppression on settle/cancel or disposal. Multiple calendar roots
   are handled independently. Native pointer tests hold a task move, a task
   resize and a timeblock move, check tooltip absence and visible preview times,
   then cancel with Escape. Existing transaction tests cover settlement/Undo.
9. **Done — list search count.** Search updates the Bases header to localized
   `visible of total tasks`. Native checks cover 0, 5 and 20 visible rows, including
   clearing search. All ten catalogues contain target-language translations.

## Measurements

Measured using the same `Council9473` fixtures before and after, at a verified
400×820 native content size with `body.is-mobile`. Values below are card heights
in CSS pixels; light and dark measurements agree. Stamps above mobile calendar
cards are separate from the card height.

| Fixture | List before → after | Board before → after | Agenda before → after | Selected day before → after |
| --- | --- | --- | --- | --- |
| Short task with passive details | 136.4 → 88.4 | 141.2 → 90.4 | 136.4 → 88.4 | 136.4 → 88.4 |
| Short scheduled task | 136.4 → 88.4 | 185.2 → 90.4 | 136.4 → 88.4 | Not present in selected-day fixture |
| Relationship task | 136.4 → 106.2 | 165.4 → 108.2 | 136.4 → 106.2 | 136.4 → 106.2 |
| Long title with rich metadata | 199.0 → 149.0 | 185.2 → 132.8 | 217.2 → 149.0 | 217.2 → 149.0 |

Typical cards are below 100px; longer titles and interactive relationship controls
can legitimately take more space. Mobile list title width is 300px of a 316px
card; board titles use 269px of a 287px card (284px of 302px without a scrollbar).
Agenda/selected-day title width is 284px of a 300px card. Raw measurements:
`/tmp/tasknotes-r7/aa/matrix-measurements.json` and
`/tmp/tasknotes-r7/aa/regression/measurements.json`.

## Evidence

All evidence is under `/tmp/tasknotes-r7/aa/`. The final matrix contains before
and after List, Board, Agenda, Calendar, Inline and Settings captures in light
and dark at 1180×820 and 400×820. Filename pattern:
`{before,after}-{surface}-{theme}-{width}.png`.
`comparison-{theme}-{width}.jpg` contact sheets group those images; individual
PNGs are the real-size evidence. List hover, focus and selected-hover captures
are alongside the resting images. Search, disclosure, overflow and held/cancelled
gesture captures are in `regression/`.

Five useful after images:

- `/tmp/tasknotes-r7/aa/after-list-dark-400.png`
- `/tmp/tasknotes-r7/aa/after-board-light-1180.png`
- `/tmp/tasknotes-r7/aa/after-inline-light-400.png`
- `/tmp/tasknotes-r7/aa/after-calendar-dark-400.png`
- `/tmp/tasknotes-r7/aa/regression/after-calendar-held-timeblock.png`

Earlier ad-hoc evidence includes `before-settings-keyboard.png`,
`before-search-empty.png` and `before-calendar-tooltip-held.png`. These helped
reproduce the bugs, but the final comparison matrix supersedes early captures
for theme and native-window sizing accuracy.

## Validation and limitations

- Strict lint, typecheck, i18n extraction/check, production-mode `build:test`,
  vendor calendar CSS verification and the design detector all pass (exit 0).
  The detector output is `[]`. Each gate's log/exit file is in the evidence folder.
- Full Jest: 795 passing suites / 6,113 passing tests, 68 skipped suites,
  988 skipped tests and 4 todo. Exit 0. Focused new/updated unit coverage:
  3 suites / 15 passing tests.
- Library build, typecheck and lint pass. Library unit tests: 17/17; browser
  interaction tests: 27/27. Browser and lint exit files are retained.
- Final four-spec native run: 17/19 pass, exit 1 (`native-complete.log`). The
  AA-specific regression, council Y regression and all nine mobile checks pass.
  One calendar invalid-release test hits a detached-element race at line 73;
  rerunning that test unchanged passes. The final AA test (including native-size
  assertions) also passes on the recheck: 2/2, exit 0 (`native-recheck.log`).
  Thus 18 of 19 distinct tests pass across these runs, but the combined gate is
  explicitly not green. The remaining deterministic failure is described below.
- One existing resting-popover assertion in
  `e2e/calendar-composition-round7.spec.ts:371` fails: hovering a popover task
  produces its descriptive tooltip. This reproduces on the authentic baseline
  plugin and original calendar library under the same isolated Xvfb setup
  (`native-baseline-xvfb.log`, exit 1), as well as the candidate
  (`native-current-check.log`, exit 1). It is separate from held-gesture tooltip
  suppression. The assertion was not weakened and the unrelated behavior was
  not changed.
- Initial native runs on the normal display were affected by Hyprland tiling:
  the isolated Electron window stayed 1233×2075 while CDP reported the requested
  viewport. Final runs use an independent Xvfb display and verify native content
  size. The user's Obsidian instance was never used. Runtime: Obsidian 1.14.2;
  vault `/tmp/tasknotes-r7/aa/vault`; CDP port 9498; reuse disabled.
- Mobile coverage is Obsidian's `body.is-mobile` presentation and test-harness
  touch emulation on desktop Electron, not physical Android/iOS hardware.
  Default light/dark themes are covered, not arbitrary third-party themes.
  The exhaustive cross-product of pending/failure/drag/selection/domain states
  is not claimed; related specs exercise failure recovery, batch actions,
  invalid drops, settlement, Undo and domain-state fixtures.
- The existing issue-190 CSS test now distinguishes passive details decoration
  from actual controls. Interactive-target requirements remain unchanged and
  are additionally checked geometrically in native Obsidian. The existing
  calendar-composition spec is unchanged.

Final gate exits: lint 0 (`lint-final.exit`), typecheck 0, extraction 0,
i18n 0, Jest 0, build 0 (`build-final.exit`), vendor CSS 0, design detector 0
(`design-detector-final.exit`), native four-spec run 1, native focused recheck 0.
Final before/after capture matrix: exit 0 (`capture-matrix-final.exit`).
The previous AA/Y/mobile-only native run also passes 11/11, exit 0
(`native-final2.log`). No failure was hidden by weakening an assertion.

## Dependency integration and cleanup

Companion library branch: `redesign/r7-calendar-lib`, checkout
`/home/calluma/projects/tasknotes-worktrees/calendar-r2-secondary`, commit
`e14458f9d763d1e0af8789513d21c64237857d9a`.
It contains only the narrow-count implementation and browser regression.
The locally packed 0.1.7 build is installed in shared review dependencies;
`node_modules` links to the requested review-deps directory. Plugin manifest and
lockfile are unchanged. The library commit must accompany integration of this
plugin branch: a clean install of published 0.1.7 alone does not contain item 6.
Vendor CSS did not change; `scripts/calendar-css.test.mjs` passes.

No functionality is removed. Visible changes are denser mobile composition,
existing metadata overflow used instead of extra wrapped rows, a smaller passive
details glyph, inline sentence flow, accessible disclosures, compact month counts
and accurate search counts. No push, tag, release, publication or PR is created.
Tracked test-vault files are unchanged; both source checkouts are committed and
clean at handoff. The owned isolated runtime is closed and port 9498 is released.
