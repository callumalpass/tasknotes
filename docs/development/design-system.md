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
| `--tn-type-md` | 14px | Modal title field, section headers |
| `--tn-type-lg` | 18px | View and page titles |
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

Status and priority colours stay user-configurable. They colour glyphs only, never row backgrounds or large fills.

Only overdue dates are red. A date due today is `--tn-warning`. All other dates are muted. Scheduled dates are never blue.

### Space, radius, depth, motion

- Space: 4px grid: `--tn-space-1` (4) to `--tn-space-8` (32), plus `--tn-space-half` (2).
- Radius: `--tn-radius-sm` 4 (chips, keys), `--tn-radius-md` 6 (buttons, inputs, rows), `--tn-radius-lg` 8 (cards, menus), `--tn-radius-xl` 12 (modals), `--tn-radius-full`.
- Depth: flat at rest. `--tn-shadow-raised` for cards on drag. `--tn-shadow-overlay` for popovers and menus. `--tn-shadow-modal` for modals. Overlays add a hairline border.
- Motion: `--tn-motion-fast` 80ms (hover), `--tn-motion-base` 140ms (pickers, reveals), `--tn-motion-slow` 220ms (panels). Ease out with `--tn-ease`. Animate only transform and opacity. No bounce. `prefers-reduced-motion` removes all of it.
- Controls: 28px default height, 24px small. Row height 34px in list, 28px compact. On mobile, touch targets are 40px minimum.

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

`[expand][status][priority] Title  ·indicators·        [chips][assignee-ish values][date][⋯]`

- Left cluster is fixed-width so titles align across rows.
- Title truncates with an ellipsis. Hover or focus can reveal the full title via tooltip.
- Right cluster is right-aligned. Dates sit in a fixed column so they align down the list.
- Metadata values are atomic: overflow becomes a focusable `+N` with all hidden values in its tooltip. No chip truncation, masks or word-breaking. Explicit file-name columns retain the name without `.md`.
- Scheduled dates use a calendar, deadlines a flag. `taskDateLabel` in `src/ui/kit/dateLabel.ts` is the shared relative-date formatter: Yesterday/Today/Tomorrow, otherwise `MMM d` (with year outside this year), plus the configured time.
- Workflow glyphs follow configured order. The seeded unassigned status (stable ID `none`, not its editable value) is dashed and excluded from progress ranking; the first active status is an empty ring. Custom icons always win. Unknown status/priority values use a neutral question glyph, never the None glyph, with their raw value and unconfigured state in the accessible label.
- Chips (tags, contexts, projects) are neutral with a small colour dot when the user has one configured.
- Indicators (recurring, reminder, subtasks progress, details, blocked, blocking) are 14px glyphs in `--text-faint`, hidden when absent. Blocked is the only one with colour.
- `⋯` appears on hover and focus only.
- Completed tasks: muted title, no strikethrough animation, filled check.
- Below a container width of 760px the title and metadata stack, preserving complete date labels and chip overflow. Kanban cards always use that shape.
- Titles always stay on one line. Below 260px metadata yields completely to the title. Selection is a quiet tint; only the keyboard-focused row has a focus ring. Mobile actions reveal on focus/selection; long-press retains the context menu and focuses the row, revealing its move handle after dismissal.

## Views

- **List:** sticky group headers: glyph, name, count, hover `+`. Hairline only between groups.
- **Board:** column header with status glyph, name, count, `+`. Cards are `--background-primary` on a `--background-secondary` lane with a hairline border. Empty swimlanes collapse to a single row. Columns have no individual empty boxes.
- **Calendar:** view switch is a segmented control. Events are flat tinted blocks with a 2px left status line. Today is a small accent numeral, not a tinted column.
- **Agenda, mini calendar, timeblocks:** same chips, glyphs and date treatment.
- **Task modal:** title first, then details, then a property bar of labelled chips. `⌘↵` saves. Create offers "Create more".
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
| `Space` | Hover preview |
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

List and board status/priority glyphs open anchored property pickers. Alt-click on a status glyph retains one-click cycling (Alt-Shift-click reverses it), including recurring-task occurrence behaviour and configured cycle exclusions. The default is a picker because an explicit choice is predictable across arbitrary custom workflows; ordinary card click settings still govern opening/editing. Escape clears selection first, then the keyboard focus marker. Keyboard focus is tracked by task path rather than a recycled virtual row.

`openTaskPropertyPicker(plugin, property, tasks, anchor)` in `src/ui/taskPropertyPickers.ts` is the task-writing entry point for views. Dates retain the existing presets, relative adjustments, natural-language parser, date/time editor and clearing. Reversible property and archive actions from this layer offer a toast that restores each task's own previous values; delete retains its existing confirmation.

`openTaskPropertyChoices` builds those same pickers without persisting a task. The task modal routes choices through its draft form setters; only Save persists them. Pickers inside modals stay within the modal's focus boundary and temporarily own the Obsidian keyboard scope, so Escape and outside clicks dismiss only the picker and return focus to its chip. Tags and contexts retain their text fields; projects, recurrence and reminders retain their specialized editors.

## Theming contract

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
