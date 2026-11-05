# Round 7 AB implementation report

Date: November 6, 2026. Branch: `redesign/r7-council4`.
Baseline: `9868055272db592d5d69fc0386d29f73df22c17c`
(`redesign/linear-in-obsidian` at task start).
Scope: all nine findings in `ROUND7AB.md`, following the Round 3/4/7 rules.

## Per-item outcomes

1. **Done — selected-day panel width.** The panel is now a named inline-size
   container. At panel widths up to 480px, entries use the panel width rather
   than reserving a 16ch stamp column. Empty stamps disappear; timed stamps sit
   above their cards. Status remains beside the mobile title, with priority,
   metadata and existing actions retained. The desktop fixture's title expands
   from 157px to 253px and its empty stamp shrinks from 96px to zero. The 400px
   fixture's long title fits two lines. See `month-{light,dark}-{1180,400}.png`.
2. **Done — stable mobile board navigation.** Navigator options use stable group
   identities instead of numeric indexes. Initial mobile alignment chooses the
   first populated column, scroll derives the selected option from the visible
   column, and render/resize restores the chosen identity and alignment. Narrow
   column widths fit the actual board. Empty statuses remain selectable. Native
   tests select None, horizontally wheel away, select In progress, mutate a task
   and verify the selection survives. Unit tests also cover reordered and
   removed groups. See `board-*.png` and `board-refreshed-*.png`.
3. **Done — sentence-reference punctuation.** Sentence widgets group the status
   and menu before the title; no control follows the title before punctuation.
   Their existing inline text can wrap normally. A nonbreaking joiner attaches
   the leading controls to the link. Reading-mode refresh preserves sentence
   identity; standalone widgets retain their existing layout. Native checks
   compare punctuation rectangles with a plain note link, open the menu from
   keyboard focus and from an emulated touch, then dismiss it. Unit tests cover
   sentence and standalone control order. See `sentence-*.png`,
   `sentence-menu-*.png` and `sentence-touch-*.png`.
4. **Done — compact narrow agenda navigation.** A host-owned class identifies
   agenda-with-strip mode. At narrow widths, the strip owns previous/next/Today
   and the date heading; the engine keeps view selection and overflow in a
   compact row. Strip spacing tightens without reducing day targets below the
   shared 40px touch target. Combined toolbar/strip height drops from 239.78px
   to 172.19px; desktop remains 194.19px. Native checks navigate forward, choose
   a day, return to Today and open the overflow menu. See `agenda-*.png`.
5. **Done — shared mobile metadata row.** Contexts and tags use a horizontal,
   wrapping metadata row rather than individually stacked contexts. Space for
   the details action remains reserved; date controls and other actions stay
   separate. Native geometry checks place `@work` and `@studio` on the same
   line. See `list-*-400.png`, `board-*-400.png` and `month-*-400.png`.
6. **Done — drag Undo reconciles before confirmation.** The grouped list was
   reading stale Bases group membership after the authoritative task cache had
   already restored the status. Status/priority groups now reconcile cached
   values while retaining the existing Bases result entries and filter
   membership. Drag Undo in list and board awaits a render after file locks
   release, so the shared Undo button remains disabled and `aria-busy` until
   reconciliation completes. Native observers capture the exact creation of
   the `Undid:` confirmation and assert the restored status, Open group,
   count `(6)` and prior pending state in both surfaces. Unit tests verify
   reconciliation waits, retries and runs outside the file lock. Board Undo
   can still take around two seconds; this is not a claim of faster writes.
   See `undo-List.png`, `undo-Board.png` and `observations.json`.
7. **Done — Pomodoro history actions.** Every session reserves its optional task
   cell, and delete occupies the final grid column. In the desktop fixture,
   delete positions change from `[1116, 332]` to `[1116, 1116]`; mobile remains
   `[332, 332]`. Sessions with and without tasks are captured together in
   `history-*.png`.
8. **Done — narrow Pomodoro title.** The current task gets a full-width title
   above metadata, wrapping to at most two lines. The 400px long-title fixture
   is fully readable; native checks verify width, height and metadata position.
   Existing desktop layout is unchanged. The very-narrow menu remains
   available rather than being hidden. See `pomodoro-*.png`.
9. **Done — settings disclosure affordance.** Shared collapsible cards show a
   persistent, muted end-row chevron: right when collapsed, down when expanded.
   Existing native disclosure buttons, `aria-expanded`, hidden/inert contents
   and keyboard behavior are retained. Native tests check both icon states and
   Enter/Space toggling in light/dark at both widths. See `settings-*.png` and
   `settings-expanded-*.png`.

## Evidence and visual review

Before/after evidence is under `/tmp/tasknotes-r7/ab/{before,after}/`.
Each phase contains Month, Agenda, List, Board, Sentence, Pomodoro, History and
Settings at 1180×820 and 400×820, in standard light and dark. Images were
visually inspected, including individual full-size captures. The app's
`desk-Calendar.png` and `phone-Agenda.png` references were inspected as well.

Five representative after captures:

- `/tmp/tasknotes-r7/ab/after/month-dark-1180.png`
- `/tmp/tasknotes-r7/ab/after/month-light-400.png`
- `/tmp/tasknotes-r7/ab/after/board-dark-400.png`
- `/tmp/tasknotes-r7/ab/after/sentence-dark-400.png`
- `/tmp/tasknotes-r7/ab/after/settings-light-1180.png`

The focused regression also exercises navigation, task refresh, real drag/drop,
Undo pending/confirmation, keyboard menus, touch menu activation and settings
disclosure states. The broader native run covers additional selection, drag,
failure/retry, picker, keyboard and secondary-control states; it is not a claim
that every permutation in the common state matrix was exhaustively covered.

## Validation

All native runs use `e2e/obsidian.ts`, reuse disabled, port **9498**, separate
profiles under `/tmp/tasknotes-r7/ab/`, and Obsidian **1.14.2**. The harness
verifies `/home/calluma/worktrees/tasknotes/t3-141729ed/tasknotes-e2e-vault`
over CDP before interacting. No normal user instance is used.

| Gate | Exit | Result / log under `/tmp/tasknotes-r7/ab/` |
| --- | --- | --- |
| `npm run lint` | 0 | Strict TypeScript, review types, CSS and architecture; `lint-final.log` |
| `npm run typecheck` | 0 | `typecheck.log` |
| `npm run i18n:check` | 0 | `i18n.log`; no new translatable messages |
| `npm test -- --runInBand` | 0 | 797 passed suites, 6,129 passed tests; 68 skipped suites, 988 skipped tests, 4 todo; `jest-final2.log` |
| `npm run build` | 0 | Production bundle; `build.log` |
| `OBSIDIAN_PLUGIN_PATH=... npm run build:test` | 0 | Latest source copied into the isolated vault; `build-after3.log` |
| Dedicated `e2e/council-round7ab.spec.ts` | 0 | All nine findings; final run `e2e-after9.log` |
| Six-spec native regression battery | 1 | 49 passed, 5 failed; `e2e-regressions.log` |
| Fresh-profile mobile geometry recheck | 1 | Same native sizing failure; `e2e-mobile-check.log` |
| Impeccable changed-surface detector | 0 | No findings, `impeccable.json` is `[]` |
| `git diff --check` | 0 | No whitespace errors |

The six-spec battery comprises `council-round7aa`, `kanban-round7`,
`calendar-composition-round7`, `surfaces-round7`, `mobile-round7` and
`list-states-round7`. All five failures occur at preexisting **native window
size assertions**, before the affected geometry assertions: the desktop window
stays at 1233×2075 instead of the requested 1180×820, 1180×900 or 400×900. One
failure is the AA matrix and four are the mobile light/dark width matrix. A
fresh-profile run of the light/400 mobile case reproduces exactly the same
failure. Those checks are not weakened or presented as passing; later assertions
in those cases remain unverified in this environment.

The AB regression separately asserts actual Chromium `window.innerWidth` and
`window.innerHeight` at every requested 1180×820/400×820 viewport and records
native content dimensions alongside them in `observations.json`. Screenshots
use the isolated Electron capture path at the requested viewport. This is
native Linux Obsidian with Chromium viewport and `body.is-mobile`/touch
emulation, **not physical iOS/Android testing**, nor proof of physical desktop
window resizing. Minimal/high-contrast and third-party themes are untested.

## Scope and handoff

No dependency, package manifest, lockfile, calendar library, vendor stylesheet,
translation catalogue or `.ops/` change. The required `node_modules` symlink
points to `.redesign/review-deps/node_modules`; results qualify that linked
dependency setup, not a separately installed dependency tree. No existing E2E
assertions were relaxed. User-facing release notes are updated.

No functionality is intentionally removed: empty board columns remain reachable,
sentence menus move before titles, narrow agenda date navigation moves into the
strip, and all selected-day and Pomodoro actions remain available. This is a
scoped implementation, not an independent council score or release qualification.
The final handoff includes the local commit SHA and clean working-tree check;
there is no push, tag, publication or PR.
