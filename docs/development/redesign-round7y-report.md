# Round 7Y implementation report

## Scope and candidate

- Branch: `redesign/r7-council1`.
- Base: `92a7520dedbe37f05ac2f3107b2ba2a27eb9d15f` (`redesign/linear-in-obsidian` when work began).
- The requested fast-forward from the initial unrelated main checkout was impossible. Only the newly created, untouched task branch was recreated at the requested base; unrelated work was not reset or stashed.
- Dependencies use the requested `/home/calluma/projects/tasknotes-worktrees/.redesign/review-deps/node_modules` symlink. No dependency, calendar library, publication, or vendor changes are included.
- Native evidence uses Obsidian 1.14.2, the independently copied `/tmp/tasknotes-r7/y/vault`, separate profiles, reuse disabled, and CDP port **9496**. The launcher verifies the vault path. No normal Obsidian instance is used.
- Evidence root: `/tmp/tasknotes-r7/y/`. `before/observations.json` and `after/observations.json` record geometry and interaction results alongside the screenshots.

## Per-item results

| Item | Result | Reproduction, implementation, and evidence |
| --- | --- | --- |
| 1. Long board titles | Done | Baseline desktop title height was 156.75px; the corrected title is 39.19px with a two-line clamp. The cloned drag preview inherits the same rule. Full title tooltips and editing remain available. See `states-board.png`. |
| 2. Indicators and alignment | Done; alignment claim not reproduced | The fixture title expands from 164px to 202px at the same column width by letting indicators wrap below it. At 400px it expands from 126px to 184px. All indicators remain actionable. Title and metadata left edges are equal in both baseline and corrected captures, so the reported separate 8px offset was not reproduced and did not justify an extra indentation change. |
| 3. Zero overflow count | Done; exact native claim not reproduced | Native failed and successful collapsed-rail drops consistently displayed `+6`, not `+0`. A deterministic unit test reproduces the changing-geometry branch that could finish with zero hidden values. The summary now starts hidden and is hidden/empty when the final count is zero. Existing ResizeObservers on the values and metadata line refit against settled geometry. The native test checks the successful settle; it is not claimed as a native `+0` reproduction. |
| 4. Selector highlight ownership | Done | Hovering one row then pressing ArrowDown reproduced competing pointer/keyboard highlights. Selector CSS now gives the suggestion row sole ownership; both ordinary nested-card hover and the more-specific desktop hover rule are neutralized. Native pixel-alpha assertions confirm transparent nested cards and nonselected hovered rows in both themes and widths. See `states-selector.png`. |
| 5. Keyboard collapse focus | Done | Baseline Enter-collapse left focus on BODY. Group refresh now captures the focused group's identity and restores its replacement toggle. Native Enter-collapse/Enter-reopen succeeds in all four theme/width combinations. Existing board header focus restoration and shared task-control identity paths remain intact; broader native checks exercise refresh, selection, drag cancellation, and Undo. |
| 6. Create title accessibility | Done | Baseline exposed a placeholder-named textbox wrapper and an unnamed CodeMirror textbox. The wrapper no longer impersonates a textbox; the actual editor has the stable localized name `Title`. The fallback title textarea uses the same localized field name. Native checks assert exactly one named title textbox. |
| 7. Failed move identity | Done | Injecting a frontmatter write failure reproduced the trailing `→ In progress · 0`. Board failure receipts collect failed task identities and place them before recovery text; zero successful-write counts are omitted. The captured result starts `Review delivery 1 · Could not save task changes…`. Successful-move wording is unchanged. |
| 8. Placeholder contrast | Done | Search, filter, shared inputs, and composer placeholders use a theme-derived metadata/placeholder token with full opacity. Measured search ratios are 8.32:1 (light desktop), 7.70:1 (light narrow), 6.55:1 (dark desktop), and 5.61:1 (dark narrow), all above 4.5:1. Explicit composer placeholder overrides also use the token. These are default-theme measurements, not a guarantee for arbitrary third-party theme foreground/background pairs. |
| 9. List drop target | Done | Baseline painted every matching row and a broad footer. Destination matching now excludes individual task cards, marks the group with a quiet inset rule, and anchors concise feedback near its header. Selection remains independent. Native held-pointer captures and assertions verify no per-card destination fill. See `states-list.png`. |
| 10. Configured drag labels | Done | The baseline hint exposed `status → review`; the corrected hint reads `status → In review`, and empty destination rails resolve configured status/priority labels through the existing managers and localization helper. Truly unknown values retain their raw identifiers. |
| 11. Stable composer | Done | Baseline desktop expansion jumped from 560px to 850px. Compact and expanded states now stay 720px; the narrow composer remains 384px. The extra-wide breakpoint also stays on that width. Split details retain the existing 280px minimum rather than collapsing in Minimal-style themes. Native 1280px populated-title/details checks confirm readable columns, stable width, and no note creation after explicit discard. Field/relation label rhythm is shared; controls remain scroll-reachable. See `states-create.png`. |
| 12. Settings explanations | Done | Long property descriptions and the large status/priority explanation panels are native inline disclosures, with existing translated labels and the original prose retained. Concise descriptions stay beside controls. Heading/help spacing is reduced. Native checks open and close description and status-value help using Enter with visible keyboard focus. Narrow settings navigation remains the concurrent mobile slice's responsibility. See `states-settings.png`. |
| 13. Statistics hierarchy | Done | The project time bar now has an explicit localized `Time tracked / estimated` label and separation from completion. Project and section headings have clearer hierarchy. `Last activity` and `Avg` are plain inline metadata in both themes, not badge containers. Data, charts, and filtering are unchanged. See `states-stats.png`. |
| 14. Sentence reference gap | Done | The internal status/title gap increases from the half-space token to the regular small-space token. No surrounding text, punctuation, or external widget margin is changed. Native reading-mode checks retain the following `, then ship.` text. Existing sentence line-wrapping behavior is not redesigned here. See `states-references.png`. |
| 15. Metadata casing | Done | Raw native property identifiers no longer override the existing localized default display labels, so default labels render as `Scheduled`, `Due`, etc. Explicit custom display labels remain unchanged. Focused unit coverage checks both cases. |

## Validation

| Gate | Exit | Result / evidence under `/tmp/tasknotes-r7/y/` |
| --- | --- | --- |
| Full lint, including strict TypeScript, review types, CSS, architecture | 0 | `lint-final.log`; individual lint stages pass, not only the wrapper. |
| Typecheck | 0 | `typecheck-final.log`. |
| Translation extraction and catalogue/source checks | 0 | `i18n-extract.log`, `i18n-check.log`; existing translated descriptors are reused, with no English placeholder translations added. |
| Production build and isolated-vault build/copy | 0 | `build-final.log`; `build:test` runs the production build before copying. |
| Full Jest | 0 | `jest-full-final.log`: 794 suites and 6,104 tests pass; 68 suites / 988 tests remain skipped and four tests are todo. Skips are not reported as passes. |
| Focused final Jest | 0 | `jest-focused-final.log`: five suites / 31 tests pass. |
| Design detector | 0 | `impeccable.json`: no findings. |
| Extended native regression attempt | 1 | `e2e-regressions.log`: 32 of 36 scenarios pass; limitations below. Failure traces and screenshots are retained in `regression-artifacts/`. |
| Independent baseline controls | 0 | `e2e-baseline-controls.log`: original-base board auto-scroll and light-400 settings reorder scenarios both pass in isolation. |
| Final focused native controls | 0 | `e2e-final-controls.log`: board auto-scroll and both desktop-theme settings interaction/reorder scenarios pass, three of three. |
| Refreshed original-base council capture | 0 | `e2e-before-refreshed.log`: one native scenario passes against the separately archived original base; before captures include the expanded status settings and actual theme verification. |
| Final council native scenario | 0 | `e2e-final.log`: one native scenario passes (50.8 seconds), covering all four width/theme combinations plus the populated 1280px split composer. |
| Final whitespace check | 0 | `git diff --check`; no whitespace errors. |

The extended run's failures are not hidden or called a clean native suite:

1. `kanban-round7.spec.ts`, held board auto-scroll: the initial run observed `scrollTop === 0` rather than `>800`. The original-base control and final-candidate rerun both pass without changing the test or scroll implementation. This is an intermittent result, not a confirmed fixed regression or a proven pre-existing bug.
2. `surfaces-round7.spec.ts`, light-400 and dark-400 settings reorder: both reached the two-minute timeout while evaluating an already-visible drag handle, then closed their page. The original-base light-400 scenario passes in isolation, so these results are not evidence of an always-reproducible base defect either.
3. `surfaces-round7.spec.ts`, light-400 toolbar/menu/toast/secondary controls: native Electron screenshot capture reached the test timeout and its Playwright fallback saw a closed page. This full-flow capture failure remains unresolved; it is not counted as interaction coverage.

The narrow settings/reorder and full narrow-toolbar flows therefore remain partial native validation. The focused council checks independently cover the changed disclosure, composer, list/board feedback, selector, and reference behavior across both requested widths and themes.

The existing issue-1512 unit assertions were deliberately updated: flexible left tracks replace the old hard-coded 380px/480px tracks, but the details pane still has a 280px minimum and the extra-wide composer remains stable. Its original protection against character-by-character details wrapping is retained. No existing E2E assertions were weakened or skipped.

## Evidence and limitations

- Every touched surface has original-size light/dark desktop (1180×800) and narrow (400×800) before/after captures. Contact sheets are labelled indexes; their source images retain full size.
- The final seven `states-*.png` sheets were regenerated from the refreshed baseline and final candidate and visually inspected. Expanded settings help and the populated 1280px composer also have separate inspected captures. Generated fixture totals differ across statistics captures; aggregate task counts are not treated as a before/after correctness comparison.
- State evidence includes rest, hover, keyboard focus, compact/expanded forms, pointer-to-keyboard selection, held drags, collapsed targets, injected failure, successful settle, Escape, and disclosure activation. Broader specs add selection, pending writes, Undo, invalid destinations, refresh during drag, and touch emulation.
- Narrow and touch tests emulate the desktop runtime with `body.is-mobile` and CDP touch input where applicable; they are not physical Android/iOS evidence.
- No functionality is intentionally removed. Board title text beyond two lines is available by tooltip/edit; all indicators remain. Help prose moves behind keyboard-accessible disclosure. The more compact composer can require scrolling for secondary controls.
- No independent council rescore is claimed. Concurrent Slice X ownership is preserved: mobile target/layout work, success-toast wording, invalid-date messages, batch counts, board navigator, and narrow settings navigation are not redesigned.
- Runtime fixtures, profiles, logs, and screenshots are outside the checkout. `.ops/` is not included. No push, tag, publication, or PR is performed.
- Final cleanup removes only this slice's `CouncilY-*` generated folders from its isolated vault. Port 9496 is closed and no owned Obsidian process remains; screenshots, logs, failure traces, and inactive profiles are retained as evidence. Tracked source-vault fixtures are unchanged.

## Selected after captures

- `/tmp/tasknotes-r7/y/after/board-light-1180-rest.png`
- `/tmp/tasknotes-r7/y/after/list-dark-1180-drag-target.png`
- `/tmp/tasknotes-r7/y/after/create-dark-1280-populated-expanded.png`
- `/tmp/tasknotes-r7/y/after/selector-dark-1180-pointer-keyboard.png`
- `/tmp/tasknotes-r7/y/after/stats-light-1180.png`
