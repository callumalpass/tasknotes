# Round 7, Slice O: overlays and secondary surfaces

Implementation and native review, November 6, 2026. Branch: `redesign/r7-surfaces`.
Base: `aaa92cc232b96e92a39c7400813e7469ffafda29` (`@tasknotes/calendar` 0.1.7).
No dependency, calendar-library, task-card renderer, or persisted-schema changes.
Nothing pushed or published.

## Changes and findings

| Area | Result | Evidence and boundaries |
| --- | --- | --- |
| Shared control states | Done: quieter property surfaces, consistent token-based keyboard/pressed/disabled/busy treatment, hover rules gated by pointer capability. | Four theme/width combinations; actual pointer-down screenshots, keyboard focus, and unchanged hover geometry. Native Obsidian controls remain native. |
| Picker pointer/keyboard ownership | Done: pointer movement updates one active row without scrolling; keyboard navigation reveals its active row; stationary pointer coordinates cannot reclaim keyboard focus after repaint. Selected values retain their checkmark instead of a second highlight. | Native pointer sweeps and pointer-to-keyboard handoff; unit coverage for stationary-pointer events and the free-text creation row. Combobox/listbox IDs and active-descendant relationships are explicit. |
| Task composer | Done: less bordered chip clutter without changing property values or removing fields. Pointer/touch picker selection returns focus without inheriting the text input's keyboard ring; the next key restores normal keyboard focus treatment. | Light/dark, 1180/400; custom long status labels and 24 statuses; CDP touch changes a draft status, checks no lingering outline, and compares the unchanged note bytes before closing without Save. |
| Precise date and reminder controls | Done: shared keyboard-only focus; removed duplicate date-input focus treatment; no reminder-preset hover movement. | Actual time-input focus has no box shadow and one 2px outline. Reminder Cancel, relative/absolute selection, and disabled Save are captured separately; disabled controls are not claimed to have focus or press states. |
| Settings navigation and forms | Done within O: shared tab/select/input/toggle interaction treatment. | Native navigation, text input, toggle rest/hover/press/focus and changed selection in all four variants. The 400px host-settings layout still needs Slice X's container/layout work; see below. |
| Settings workflow reorder | Done: Lucide grip, focusable handles, Alt+Up/Down with focus restoration, static dimmed source, compact themed drag image, stable insertion marker. Escape/dragend remove every marker; foreign payloads cannot reorder local cards. | Real held native drag, Escape, successful pointer drop/settle, invalid destination, browser edge auto-scroll, and keyboard reorder in all four variants. Unit tests cover edge bounds, foreign payloads and cancellation. Settings lists reorder one value at a time; task multi-drag is not part of this surface. |
| Bases toolbar and menus | Done: injected New uses the existing kit ghost button. | Rest/hover/press/focus and task-menu keyboard captures. Native menu rendering, item order, shortcuts and authority are preserved. |
| Toasts | Done: pending action remains visible and busy/disabled until completion, rejects duplicate invocation, and cannot time out during pointer/focus changes while pending. Failure receives semantic error treatment. | Actual pending Undo is held at the test vault's write boundary, then released. Property-write rejection is injected and restored in `finally`. Generic action rejection/retry, timer boundaries, conflict receipts and Undo history are unit tested. One visible toast and older Mod+Z history remain. |
| Timer and reports | Done: shared focus/pressed/disabled treatment and pointer-capability-gated hover, including report filters. | Real timer/report controls in four variants; existing native regression checks retain timer editing, start/pause/resume/stop, filters, report navigation and empty states. |
| Inline task controls | Done: neutral conversion-action hover, token focus, and keyboard-revealed overflow independent of hover media support. | Sentence and standalone references, actual status hover/press/focus and keyboard menu access in four variants. Existing reading/live-preview tests cover custom icons, unknown values, overdue dates and blocked tasks. No metadata or sentence behavior was removed. |
| Segmented kit helper | Done, unit-level: roving tab stop, arrows/Home/End, disabled skipping and RTL direction handling. | No production caller currently uses `createSegmentedControl`; native reminder tabs are separately exercised. Do not interpret helper unit coverage as native integration coverage. |

Cross-ownership changes are limited to the settings card's existing reorder helper,
the injected Bases toolbar button and failed-property toast intent. Three drag/disabled
tokens were appended to the interaction group in `styles/tokens.css`; existing tokens
were not redefined. Slice A retains ownership of the card renderer and design-system
document. The unused legacy filter-bar stylesheet was left unchanged after checking
that it has no rendered production component to validate.

No functionality or data was removed. Visible differences include quieter property
borders, removal of the rotating drag source and reminder hover lift, a neutral picker
cursor with a keyboard ring, the grip icon, and the pending Undo indicator. Fields,
custom values, settings controls, native menu actions, task prose, Save and Undo remain
reachable through the existing paths. No new translated messages were introduced.

## Capture inventory

All evidence is local under `/tmp/tasknotes-r7/o/`, outside the checkout. Raw captures
are native Obsidian windows at **1180×800** and **400×800**, light and dark. Narrow runs
set `body.is-mobile`; touch uses CDP touch events. This is desktop-native mobile
emulation, not Android/iOS or physical touch hardware.

- `before/`: exact-base captures; supplemental baseline source was exported with
  `git archive aaa92cc23` into `baseline-source/` and built independently. Only this
  worktree's test-vault bundle was temporarily swapped; final source and bundle were
  restored and rebuilt afterward.
- `after/`: candidate captures. `after/regression/` preserves additional native
  regression captures before Playwright cleans its output directory.
- `capture-inventory.json`: per-surface raw image inventory.
- `states-<surface>-before.png` and `states-<surface>-after.png`: labelled contact
  sheets. Their reduced thumbnails are indexes, not substitutes for real-size review.

Final inventory: 306 before and 330 after raw state captures, indexed by 36 sheets
across 18 surfaces. Additional regression captures are not included in those counts.

Sheet surfaces: `composer`, `picker`, `date-picker`, `date-input`, `reminders`,
`reminder-segments`, `settings-navigation`, `settings-input`, `settings-toggle`,
`settings`, `toolbar`, `menu`, `toast`, `tasknotes-pomodoro-view`,
`tasknotes-stats-view`, `tasknotes-pomodoro-stats-view`, `report-filter`, `inline`.
Baseline handles were not keyboard-focusable; those captures are honestly labelled
`focus-unavailable`. Pending/error/auto-scroll are additional after states, not
fabricated baseline equivalents.

Five useful real-size after captures:

1. `/tmp/tasknotes-r7/o/after/picker-light-1180-keyboard-after-pointer.png`
2. `/tmp/tasknotes-r7/o/after/composer-dark-400-touch-draft.png`
3. `/tmp/tasknotes-r7/o/after/settings-dark-1180-drag.png`
4. `/tmp/tasknotes-r7/o/after/date-input-light-400-focus.png`
5. `/tmp/tasknotes-r7/o/after/toast-light-400-pending-disabled.png`

Real-size review found and corrected the collapsed-card opacity overriding the drag
source, double precise-date focus treatment, a keyboard ring surviving touch picker
selection, and the inline overflow's focus rule accidentally living inside a hover-only
media query. The pending timer was additionally
checked against mouseleave/focusout while the action is unresolved.

## Validation

Commands run from this worktree, with no reused instance:

```sh
OBSIDIAN_PLUGIN_PATH="$PWD/tasknotes-e2e-vault/.obsidian/plugins/tasknotes" npm run build:test
TASKNOTES_E2E_RUNTIME_DIR=/home/calluma/projects/tasknotes/.obsidian-unpacked \
TASKNOTES_E2E_REUSE_OBSIDIAN=0 \
TASKNOTES_E2E_REMOTE_DEBUGGING_PORT=9495 \
TASKNOTES_E2E_USER_DATA_DIR=/tmp/tasknotes-r7/o/profile-candidate \
npm run e2e -- e2e/surfaces-round7.spec.ts
```

The harness verified Obsidian **1.14.2** and vault
`/home/calluma/worktrees/tasknotes/t3-c13c192f/tasknotes-e2e-vault`.

| Check | Result | Log under `/tmp/tasknotes-r7/o/` |
| --- | --- | --- |
| Full Jest | Exit 0: 793 suites / 6,087 tests passed; 68 suites / 988 tests skipped; 4 todo. Skips/todos are not passes. | `jest-final.log` |
| Focused kit/toast/settings unit tests | Exit 0: 3 suites / 18 tests, included in the full run. | `unit-final.log` |
| Earlier broad native regression | Exit 0: 76 passed, seven specs. | `native-regression.log` |
| Native secondary/inline regression plus expanded O state suite | Exit 0: 26 passed. | `native-final-states.log` |
| Final native O and modal/menu suites | Exit 0: 29 passed. Includes pointer focus restoration, date/reminder focus changes and expanded form/segment state captures. | `native-candidate-final.log` |
| Lint runner and explicit strict ESLint/CSS | Exit 0; individual checks inspected because the runner does not stop on child failure. Architecture conformance passed. | `lint-final.log`, `eslint-final.log`, `stylelint-final.log` |
| TypeScript | Exit 0. | `typecheck-final.log` |
| i18n | Exit 0, 470 modules. | `i18n-final.log` |
| Production build and isolated-vault copy | Exit 0. Build also runs catalogue and Obsidian UI source guards. | `build-candidate.log` |
| Bundle budget | Exit 0: 4,435,939 bytes, below the 5,000,000-byte limit. | `bundle-size.log` |
| Mechanical design detector | Exit 0, no findings (`[]`). This is not a visual approval. | `design-detector.json` |

The new `e2e/surfaces-round7.spec.ts` adds state and behavioral evidence rather than
weakening prior assertions. Existing specs were not made stale or loosened. Harness
iterations fixed a hidden duplicate Markdown rendering being counted as visible
content, ancestor-card ambiguity, scrolling before native drag, and baseline handles
incorrectly being required to support the new focus behavior. Failed attempts remain
in the evidence logs; only corrected completed runs are reported as passing.

One intermediate candidate run timed out waiting for the injected-failure picker
after separate focus and keyboard protocol calls during task refresh (15 passed,
1 failed; `native-candidate.log`, trace preserved in `failed-candidate/`). The fixture
now sends the shortcut with `locator.press`, keeping focus and the key in one native
input action. The corrected full O rerun passed 16/16
(`native-candidate-verified.log`). This does not claim to fix Slice A's background
task-render/focus behavior; the last source change to popover focus restoration has
its own final native run.

## Remaining boundaries and handoff

- **Slice X still required:** native settings at 400px retain Obsidian's sidebar,
  leaving a very narrow content pane; labels and descriptions are cramped. This is
  visible in the captures and is not a screenshot-worthy final mobile settings layout.
  O's focus/reorder improvements do not claim to solve X's container-width work.
- **Failure recovery ownership:** failed property feedback now has error intent and
  preserves the existing actionable explanation. A new task-route/Retry action and
  revised outcome/count language remain Slice X items, not implemented here.
- Native CDP screenshots prove the held source/insertion states, but do not capture
  the OS-composited drag bitmap reliably. The drag-image DOM is themed and compact;
  its actual OS bitmap remains a manual visual check.
- Native pointer sweeps and keyboard handoff are covered. Background-repaint pointer
  ownership is unit-tested, not a live concurrent-vault-refresh native stress test.
- Native system date panels, physical touch, every third-party theme, screen-reader
  announcement behavior and every task-domain-state/control cross-product are not
  claimed. Card/list/board multi-selection and task drag belong to A/K; calendar
  rendering and calendar motion belong to W.
- Cleanup completed: tracked fixture data restored, owned generated report view
  removed, no remaining generated surface folders, and port 9495 confirmed closed.
  No real account or normal Obsidian profile was touched.
