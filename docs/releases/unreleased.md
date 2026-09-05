# TaskNotes - Unreleased

<!--

**Added** for new features.
**Changed** for changes in existing functionality.
**Deprecated** for soon-to-be removed features.
**Removed** for now removed features.
**Fixed** for any bug fixes.
**Security** in case of vulnerabilities.

Always acknowledge contributors and those who report issues.

Example:

```
## Fixed

- (#768) Fixed calendar view appearing empty in week and day views due to invalid time configuration values
  - Added time validation in settings UI with proper error messages and debouncing
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

When a change has user-facing documentation, include a canonical tasknotes.dev link:

```
## Added

- Added materialized occurrence notes for recurring tasks. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#materialized-occurrence-notes) for setup and calendar behavior.
```

-->

## Fixed

- (#1849) Fixed context menus stacking on top of each other. Only one menu stays open at a time, and clicking the same indicator again closes its menu. This previously applied to date fields only, and now covers priority, status, recurrence, reminders, task, ICS event, and batch menus.
  - Thanks to @3zra47 for reporting and @YBKF for the contribution.

## Added

- (#2147) Added context-menu actions for recording task completion today, on the scheduled date, on the due date, or on a chosen date. The actions can be grouped in a submenu from Appearance settings. See [Completing Tasks](https://tasknotes.dev/features/task-management/#completing-tasks).
  - Rescheduling a recurring task can reactivate affected completed or skipped instances after confirmation. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/).
  - Thanks to @renatomen for the contribution.
- Added configurable task-card keyboard shortcuts, including per-user-field
  bindings, in **Settings → TaskNotes → Keyboard shortcuts**. Task List cards
  support navigation, multi-selection, task editing and organization, search,
  copy, archive, and delete actions; defaults include `j`/`k` navigation,
  `x` selection, `e` to mark complete, and `t` to edit time estimates. See
  [Task List View](https://tasknotes.dev/views/task-list/) for the supported
  interactions.
- Added keyboard shortcut support to Kanban, Agenda, and Calendar list views.
  Calendar grid views apply their single-task shortcut subset to the task under
  the mouse pointer.
- Added keyboard editing for user-defined properties, with a focused edit
  modal that supports recent values, `Alt+Down` selection, and date-entry
  confirmation.
- Added configurable list-property drag-and-drop behavior. Dragging between
  groups can replace or add values for projects, tags, contexts, aliases, and
  custom list properties; the default allows holding Shift to add values.
- Added multi-task drag-and-drop for visible selected cards, preserving their
  visual order while moving them as a contiguous block. Project drops now use
  the same canonical link form as the task modal, and projects can be removed
  directly from that modal.

## Fixed

- Fixed recurring task completion from task-card status controls and the
  **Mark complete** shortcut so it records completion for the current
  occurrence instead of incorrectly marking the recurring parent done.
- Fixed keyboard focus, selection styling, and shortcuts after task edits,
  view changes, and virtual-scroller recycling. Task List navigation can now
  reach virtualized cards that have not yet been mounted.
- Fixed task-card keyboard ownership around menus, modals, search inputs,
  embedded editors, and hover interactions, so overlays and active editors
  retain their expected input behavior and focus returns to the originating
  task when appropriate.
- Fixed task-card dragging in ordinary and embedded Live Preview Bases views,
  and fixed reordering when dragging a multi-selection without changing its
  group.
- Fixed list-valued task groups with the same values in different orders being
  displayed separately, and made each project in a multi-project group heading
  a usable link.
- Fixed Agenda view selection styling not appearing on its initial render.
- Improved task-card rendering efficiency by batching task-information cache
  lookups.
