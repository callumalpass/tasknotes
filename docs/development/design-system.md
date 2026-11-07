# TaskNotes design system

North star: **Linear's discipline, Obsidian's skin.** TaskNotes should feel like a precise, fast, keyboard-first work tool that happens to live in Obsidian. Colour, fonts and surfaces come from the active theme. Density, alignment, hierarchy, interaction and restraint come from this document.

If a screen looks like a stock settings form, a Material dashboard, or a pile of chips, it is wrong.

## Principles

1. **One line, one task.** The default task row is a single line. Properties are aligned, not narrated.
2. **Values, not labels.** "Dec 31" with a calendar icon, never "due: Dec 31, 2025 17:00 (overdue)". Labels live in tooltips, column headers and pickers.
3. **Colour is signal.** Chrome is neutral. Colour marks status, priority, lateness, selection and the single primary action on a surface. Nothing else.
4. **Quiet until touched.** Secondary controls appear on hover, focus or selection. At rest a list is text and glyphs.
5. **Every action has a key.** Anything a mouse can do on a task, a keyboard can do, and the hint is visible where the action is offered.
6. **Pick, don't open.** Change one property with an anchored picker. The full modal is for creating tasks and for deep edits.
7. **Instant feedback, undo over confirm.** State changes show immediately. Reversible actions offer undo in a toast. Only irreversible ones ask first.
8. **Same thing, same look, everywhere.** A status is the same glyph in the list, board, calendar, modal, picker, inline widget and settings.
9. **The vault stays visible.** Tasks are Markdown notes. Never hide that; opening the note is always one action away.

## Tokens

`styles/tokens.css` is the only place raw design values live. All other plugin CSS uses tokens. The error-level `tasknotes/design-tokens` stylelint rule rejects literal font sizes, radii and hex colours, including custom properties and `var()` fallbacks. The documentation site's independent stylesheet is outside this plugin contract. Run `node --test tests/scripts/stylelint-design-tokens.test.mjs` to check the ratchet. Everything is scoped under `.tasknotes-plugin`; the overlay root also carries that class.

Inline card rules live in `styles/task-inline-widget.css`, after the shared card rules. The public `.tasknotes-inline-widget`, `.task-inline-preview--reading-mode`, task state/layout/date classes and user-facing theming variables remain available to snippets. The retired `.task-inline-preview__*` implementation had no remaining renderer; it is not the public reading-mode hook. Statistics retain their existing class hooks while using report rows rather than dashboard tiles. Native notices use `showNotice` from `src/ui/kit/notice.ts`; reversible action toasts remain a separate kit component.

### Type

Family is always `var(--font-interface)`; tabular data uses `font-variant-numeric: tabular-nums`. There is no display face.

Sizes are multiples of `--font-text-size`, so they follow Obsidian's font size setting. Values below are at the default 16px.

| Token | Size | Use |
| --- | --- | --- |
| `--tn-type-2xs` | 11px | Keyboard hints, group counts, calendar weekday headers |
| `--tn-type-xs` | 12px | Metadata, chips, dates, secondary labels |
| `--tn-type-sm` | 13px | **Default UI size:** task titles, menus, buttons, inputs |
| `--tn-type-md` | 14px | Section headers |
| `--tn-type-lg` | 18px | View, page and task modal titles |
| `--tn-type-xl` | 24px | Single hero numerals (timer, stat values) |

Weights: 400 and 500, with 600 reserved for view titles. Never use uppercase tracking as hierarchy except calendar weekday headers. Letter-spacing stays default.

### Colour

Surfaces and text come only from the theme: `--background-primary`, `--background-secondary`, `--background-modifier-*`, `--text-normal|muted|faint`.

| Token | Meaning |
| --- | --- |
| `--tn-hairline` | 1px separators. Lighter than the theme border |
| `--tn-hover` | Row and control hover |
| `--tn-active` | Pressed |
| `--tn-selected` | Selected row, accent-tinted |
| `--tn-focus-ring` | Keyboard focus |
| `--tn-danger`, `--tn-warning`, `--tn-success`, `--tn-info` | Theme-derived semantic colour |

Status and priority colours stay user-configurable. They colour glyphs, never task-row backgrounds. Status-grouped Kanban columns retain a restrained 5% body tint from a resolvable status colour, mixed with the theme's secondary surface; invalid colours stay neutral.

Calendar chips use theme text on a quiet surface, with a small hue mark derived from the configured colour. Clamp the mark's OKLCH lightness and chroma separately for light and dark themes before tinting the surface. Completed chips keep opaque text and a quieter mark. Selection adds an opaque accent outline, a theme-surface separator and a checkmark, rather than relying on the fill hue.

Only overdue dates are red. A date due today is `--tn-warning`. All other dates are muted. Scheduled dates are never blue.

### Space, radius, depth, motion

- Space: 4px grid: `--tn-space-1` (4) to `--tn-space-8` (32), plus `--tn-space-half` (2).
- Radius: `--tn-radius-sm` 4 (chips, keys), `--tn-radius-md` 6 (buttons, inputs, rows), `--tn-radius-lg` 8 (cards, menus), `--tn-radius-xl` 12 (modals), `--tn-radius-full`.
- Depth: flat at rest. `--tn-shadow-raised` for cards on drag. `--tn-shadow-overlay` for popovers and menus. `--tn-shadow-modal` for modals. Overlays add a hairline border.
- Motion: `--tn-motion-fast` 80ms (hover), `--tn-motion-base` 140ms (pickers, reveals), `--tn-motion-slow` 220ms (panels). Ease out with `--tn-ease`. Spatial motion uses transform and opacity; state fills may cross-fade without changing geometry. No bounce. `prefers-reduced-motion` removes all of it.
- Controls: 28px default height, 24px small. Task rows use `--tn-task-row-height` (58px), `--tn-task-row-height-wide` (40px), `--tn-task-row-height-phone` (72px) and `--tn-task-row-height-compact` (46px); the older 34px/28px row tokens remain for non-task controls. On mobile, touch targets are 40px minimum.

## Kit

`src/ui/kit/` is the component layer. Plain TypeScript and DOM, no framework. Views compose kit parts; they do not restyle them.

| Part | File | Notes |
| --- | --- | --- |
| Status glyph | `glyphs.ts` | Ring that fills by workflow progress; check when complete; cross when skipped. Custom icons win |
| Priority glyph | `glyphs.ts` | Signal bars by rank; solid alert for top rank; dashes for none. Custom icons win |
| Date label | `dateLabel.ts` | Relative label, lateness colour |
| Key hint | `keyHint.ts` | Renders `⌘K`, `S`, platform aware; omitted on touch/mobile |
| Button, chip, segmented control | `controls.ts`, `kit.css` | `tn-btn`, `tn-chip`, `tn-segmented` |
| Popover | `popover.ts` | Anchored overlay on the anchor window body or modal container, focus return, Esc, outside click, viewport clamp and flip |
| List picker | `listPicker.ts` | Typeahead list on popover: arrows, Enter, shared footer, checked current value, applied-first multi-select |
| Toast | `toast.ts` | Bottom-right, one result with a changed-task count and Undo; does not cover the central title column |
| Empty state | `emptyState.ts` | One sentence, one action, key hint |

## Task row anatomy

`[expand][status][priority] Title ·indicators· [⋯]`

`                          values        calendar value    flag value`

- Left cluster is fixed-width so titles align across rows.
- Desktop titles truncate with an ellipsis. Hover or focus can reveal the full title via tooltip. Mobile list titles wrap, with metadata aligned to the title beneath and 40px action targets. Agenda and inline lists retain their own stacked composition.
- Lists use one line in panes at least 860px wide, with a 40px minimum row height and equally allocated title/metadata lanes. The breakpoint belongs to the view, not the individual row or title length. Narrower panes retain stacked rows. Phone rows have a 72px minimum, growing for wrapped titles. There are no chip borders. Wide dates show calendar/flag icons and values; full field names and overdue meaning remain in accessible names and tooltips.
- Metadata values are atomic: overflow becomes a focusable `+N` with all hidden values in its tooltip and a read-only kit popover on activation. No chip truncation, masks or word-breaking. Explicit file-name columns retain the name without `.md`.
- Scheduled dates use a calendar, deadlines a flag. `taskDateLabel` in `src/ui/kit/dateLabel.ts` is the shared relative-date formatter: Yesterday/Today/Tomorrow, otherwise `MMM d` (with year outside this year), plus the configured time.
- Workflow glyphs follow configured order. The seeded unassigned status (stable ID `none`, not its editable value) is dashed and excluded from progress ranking; the first active status is an empty ring. Custom icons always win. Unknown status/priority values use a neutral question glyph, never the None glyph, with their raw value and unconfigured state in the accessible label.
- Chips (tags, contexts, projects) are neutral with a small colour dot when the user has one configured.
- Indicators (recurring, reminder, subtasks progress, details, blocked, blocking) are 14px glyphs in `--text-faint`, hidden when absent. Blocked is the only one with colour.
- `⋯` appears on hover and focus only.
- Completed tasks: muted title, no strikethrough animation, filled check.
- Metadata overflow preserves complete values; empty wide date slots retain column alignment. Note indicators are quiet at rest and strengthen on hover/focus. Phone rows omit the redundant note glyph and reveal menu/reorder controls on focus or selection; metadata rows place those controls at the trailing edge. Long-press retains the context menu without persistent chrome; dismissal returns focus to the row unless another control has acquired focus. Rows without metadata retain their smaller, single-line layout. Kanban and agenda retain their own host layout.
- Desktop list titles stay on one line; board titles have up to two lines with an indicator/menu gutter that does not change on hover. Board columns retain a useful minimum width and scroll with snap instead of crushing their contents. Mobile columns leave a neighbouring lane visible and retain a horizontal scroll track. Below 260px desktop list metadata yields completely to the title. Selection is a quiet tint; only the keyboard-focused row has a focus ring.

### List interaction states

- Board cards hug their content rather than reserving a second title line. Column headers reserve `--tn-board-header-height` for two lines; scrollbar gutters and widths stay constant through hover, lift and post-drop refresh. View refresh restores board axes and individual column scroll positions before painting.
- Selection counts include a visible clear-selection hint and occupy their own space above the view's rows, never covering tasks or phone navigation. A row uses the normal link cursor; only its drag handle promises dragging. Hovering nested content reveals the nested row's menu, not its parent's menu.
- A row's highlight is painted behind its main row only, never behind expanded children. The same inset and radius apply to hover, press, selection and drop. Row controls retain their own smaller hover target. Nothing translates, grows or reflows on hover.
- Fine-pointer hover enters immediately (`--tn-motion-hover-in`) and exits with `--tn-motion-fast`. Hover rules exclude `body.is-mobile`; taps do not leave a sticky highlight. Selection uses `--tn-selected`, selected hover uses `--tn-selected-hover`, and only keyboard navigation paints the row focus ring. Focus entering an inner control removes the competing row ring.
- Card refresh preserves view-owned selection, drag and keyboard classes while replacing task-data classes. During a list drag, task updates wait until cancellation/drop so targets cannot move beneath the pointer.
- Dragging a selected row moves the visible selection; dragging an unselected row moves only that row. The source dims in place via `--tn-drag-source-opacity`; list previews retain the row's layout and width, offset from the pointer to expose feedback. Multi-drag retains its stack and count. Drag surfaces, shadows, insertion lines, invalid targets and settle motion come from the shared drag/drop tokens.
- Manual reorder uses an overlay insertion line rather than shifting neighbouring rows. Group destinations get a quiet fill; invalid/read-only targets show an explanation and cannot write. Escape, touch cancellation and drag end remove every source/target/preview class and stop edge scrolling. Successful reorder and group changes use guarded Undo.
- A pending status write disables its actual delegated control, not the list container. Failed writes retain a visible status outline and the shared writable-note recovery toast; retrying clears it. Completion and drop settle use short interruptible motion, disabled by reduced-motion preference.
- Cross-group list drops stage the row at its sorted destination while saving, without changing persisted task fields prematurely. Failed writes restore its original position. Forced grouping highlights the destination rather than inventing an insertion position. New movement waits for pending movement writes; background refreshes cannot undo a pending landing. Mobile edge zones and toasts stop above floating navigation, including its bottom gap.

### Task presentation contract

- List rows, board cards, agenda rows, calendar events, modal chips and inline widgets use the kit's workflow-ranked status and weight-ranked priority glyphs, or the user's configured icon and colour. Unknown values retain the unknown glyph and full accessible value. With no configured priorities, absent priority and the seeded empty priority have no glyph; real unconfigured values remain visible. The modal keeps its priority chip as an editing entry point.
- Due dates use `flag-triangle-right`; only overdue/today due values carry urgency colour. Scheduled dates use the neutral calendar treatment, including Today and past dates. Relative labels and time format come from `taskDateLabel`; date urgency comes from the stored date, not an event's display position.
- Narrow rows and board cards reserve a single metadata line for compact dates before fitting atomic property chips into the remaining width. At 430px both dates stay visible; only extreme overflow makes scheduled yield before due. Oversized chips may yield to shorter following chips. The keyboard-accessible +N exposes every omitted value in its label, tooltip and read-only disclosure; it never silently discards properties. Wide lists retain aligned date columns. Scheduled agenda entries omit redundant scheduled metadata because their time column already carries it; due and tracked-time entries retain it.
- Status groups follow configured status order and priority groups follow descending priority weight, matching board defaults. Non-workflow groups retain native Bases order. Counts use the same parenthesised numeral on list and board. Duplicate filename/title metadata is omitted; different filenames remain visible. Native date values in property-event cards are read-only labels, not embedded date editors; task date controls retain their existing pickers.
- Month-grid adjacent days use secondary surfaces and faint numerals. The native Bases result count counts matching vault records, not additional timeblocks fetched from daily notes; it is not an event total and is not overwritten by the plugin.

## Views

- **List:** sticky group headers: glyph, name, count, hover `+`. Hairline only between groups.
- **Board:** column header with status glyph, name, count, `+`. Cards are `--background-primary` on a `--background-secondary` lane with a hairline border. Empty swimlanes collapse to a single row. Columns have no individual empty boxes.
- **Calendar:** view switch is a segmented control, collapsing to a bordered native selector with a chevron on narrow surfaces. Mobile navigation and selector share one row; selection and refresh live in overflow. Event fills follow the configured event/calendar or priority colour, with status colour as a fallback and measured contrasting ink. Fill strength, ink candidates and the 22px all-day height live in `styles/tokens.css`. Today is a small accent numeral, never a tinted column. Timed collision columns reserve readable width via the library's public `--tnc-collision-columns` hook and scroll horizontally rather than crushing titles. The public `--tnc-event-readable-width` hook keeps text clear of overlapping backgrounds without overriding the user's overlap setting. Timed titles clamp by the actual event height; all-day chips stay on one line. The host supplies `formatTime` to the calendar so events, stacks, selection mirrors and accessible labels share the effective view's clock preference with move feedback.

Agenda date-strip navigation and list scroll position represent the same date. Strip dots show up to three appointments in their configured colours, while the accessible day label retains the total count. Only the strip carries a filled date marker; list headings do not repeat it. Agenda and optional selected-day rows use a full-width title with inline time and metadata beneath, at every pane width; no empty time column is reserved. The selected-day count deduplicates scheduled/deadline appearances of the same task. Day view also groups overlapping clusters of three or more into the existing stack at wide widths; explicit non-overlap layouts retain their side-by-side geometry. Timed resize handles occupy at most a quarter of the event height each, leaving the centre clickable even on short appointments. Mini-calendar day cells keep their full hit area around a fixed circular number marker, and wide panes put the selected-day list beside the compact month.
- **Agenda, mini calendar, timeblocks:** same chips, glyphs and date treatment.
- **Agenda controls:** metadata controls are 24px on desktop and retain 40px touch targets on mobile. Status and row-menu controls stay 40px on both.
- **Task modal:** Create and Edit share one layout. From 900px, the left pane holds the title, a wrapping row of labelled chips and the disclosed fields, and a side pane holds the details editor at full height, even when empty. The modal has one size, so **More fields** never moves anything. Below 900px the source order applies: title, details, chips. At 600px and below the modal is a bottom sheet. On Obsidian mobile the chip row scrolls and **More fields** stays pinned to its end, so the keyboard does not share the sheet with rows of chips. Chips, buttons and field rows are `--tn-control-md`; field rows have no box at rest. Title, natural language and details fields are embedded Obsidian editors, and `workspace.activeEditor.editor` is the real editor, never an adapter, so commands, completion and plugins act as they do in a note. A title stays on one line, and Enter or Tab moves to details. `⌘↵` saves. Create offers "Create more".
- **Pomodoro and stats:** one strong number, generous space, no ring decoration around data, no card grids.
- **Settings:** native Obsidian settings controls, grouped by task, with one consistent section style.

## Keyboard

Inside a task view, with no text input focused:

| Key | Action |
| --- | --- |
| `↑` `↓` or `j` `k` | Move focus |
| `Shift` + move | Extend selection |
| `x` | Toggle selection |
| `Esc` | Clear selection, then focus |
| `↵` | Open task |
| `e` | Edit task |
| `s` | Status picker |
| `p` | Priority picker |
| `d` | Due date picker |
| `Shift+H` | Scheduled date picker |
| `t` | Tags picker |
| `c` | Create task |
| `/` | Search |
| `⌘K` | Actions for focused or selected tasks |
| `?` | Shortcut help |

Single-letter keys never fire when an input, textarea or contenteditable has focus. Plugin keys are scoped to the focused view, so global Obsidian hotkeys keep working.

Scheduled date is Shift+H in every view. Unmodified h is unbound in the list; on the board h/l and Left/Right move focus between columns.

Calendar events use the same task shortcuts, including `p` for priority, `d` for due and `t` for tags while an event is focused. Escape leaves event focus; then `t` goes to today, `d` switches to day and `p` goes to the previous period. `w`/`m` switch to week/month, `[`/`]` or `n` navigate periods, and arrows or `h`/`j`/`k`/`l` move between events. `c` creates on the focused event's date, or the visible calendar anchor date. The help button and `?` show the applicable keys. Mini-calendar day navigation remains independent and unchanged.

Search accepts Down or Enter to focus the first result. Escape clears a nonempty query; Escape again returns to the prior row. Dismissing a view picker or shortcut help returns focus to the view root, not an inert toolbar button or recycled row control. Obsidian commands remain available inside pickers.

Clicking a status glyph cycles status (Shift-click reverses it), including recurring-task occurrence behaviour and configured cycle exclusions. This stays one click because users rejected a picker here in an earlier release; `s` opens the status picker. Priority glyphs open an anchored property picker. Ordinary card click settings still govern opening/editing. Escape clears selection first, then the keyboard focus marker. Keyboard focus is tracked by task path rather than a recycled virtual row.

`openTaskPropertyPicker(plugin, property, tasks, anchor)` in `src/ui/taskPropertyPickers.ts` is the task-writing entry point for views. Dates retain the existing presets, relative adjustments, natural-language parser, date/time editor and clearing. Reversible property and archive actions from this layer offer a toast that restores each task's own previous values; delete retains its existing confirmation.

Undo history belongs to the vault, with one keyboard handler per workspace window. It remains available from inline task controls and commands as well as Bases views. Ordinary editor typing keeps its native Undo; focusing an inline task action opts into task Undo instead.

`openTaskPropertyChoices` builds those same pickers without persisting a task. The task modal routes choices through its draft form setters; only Save persists them. Pickers inside modals stay within the modal's focus boundary and temporarily own the Obsidian keyboard scope, so Escape and outside clicks dismiss only the picker and return focus to its chip. Tags and contexts retain their text fields; projects, recurrence and reminders retain their specialized editors.

## Theming contract

Small semantic date text uses `--tn-warning-text` and `--tn-danger-text`, rather than the decorative semantic colors. Their defaults mix the theme's semantic colors with `--tn-text-normal` for readable contrast on primary and secondary surfaces; themes can override either text token directly.

### Secondary composers and reports

Timeblock creation and inspection use the shared modal composer helpers: a
title-first scrollable body, date/time/color property chips, and a pinned action
footer. Clock controls follow the calendar's explicit 12/24-hour preference and
persist canonical `HH:mm` values. Inspection retains read-only times; attachments,
description, title and color keep their existing editing paths. Theme swatches
have localized accessible names, with custom CSS colors still supported.

Task and pomodoro reports use the available pane width, shared section headings,
flat ruled rows and a three-column horizon grid that becomes one column in narrow
containers. Task report filters live in a disclosure; collapsing it never resets
the filters. Settings inherit the host gutter and wrap their own tabs within the
settings content container rather than changing Obsidian's sidebar. Very narrow
settings containers use the same tab choices in a native select, preserving the
active tab and mobile integration filtering without a tall navigation wall.

Inline task widgets remain atomic inline-flex units in prose and bullets, with
end-clipped dates, an attached menu and room for following punctuation. They do
not establish a size-query container; configured metadata retains the shared
overflow-summary and context-menu paths. Mobile controls retain touch targets.

The calendar library owns responsive view selection and the empty-list content
hook. Published `@tasknotes/calendar` 0.1.6 safely ignores the prepared empty-list
hook: it retains its "Nothing scheduled" label, and the shared `c` shortcut opens
task creation. Its view buttons retain full names, accessible labels and all six
working choices at narrow widths. The enhanced compact dropdown and shared
empty-state creation button require the prepared library revision to be published
and repinned; no vendored calendar output is changed here.

Shared menu surfaces use `--tn-menu-radius`, `--tn-menu-shadow` and `--tn-menu-padding`, inheriting native Obsidian menu values. `--tn-picker-width` controls the shared picker width, constrained to the viewport. `.tn-picker__check`, `.tn-picker__footer`, `.tn-shortcut-help` and `.tn-task-arrived` provide hooks for applied values, keyboard guidance and restrained destination feedback; reduced motion disables the destination transition.

- Must look correct with the default Obsidian theme in light and dark, and with at least Minimal and one high-contrast theme.
- Never set a text colour on a surface you did not also set.
- `.task-card`, `.task-card__title`, `.task-card__metadata`, `.tasknotes-plugin`, and the status and priority data attributes (`data-status`, `data-priority`) are the public styling surface. Keep them.

## Don't

- No `box-shadow` on repeating rows. No coloured left borders on rows.
- No bare `new Notice` for an undoable action: use `toast`.
- No uppercase section labels, kickers, gradient text, emoji icons or unicode symbols as icons.
- No new hard-coded font sizes, radii or hex colours outside `tokens.css`.
- No modals where a picker will do.
