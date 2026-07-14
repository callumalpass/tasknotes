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

## Changed

- Redesigned task creation and edit modals with a Todoist-inspired layout: labeled action chips, a dedicated scheduled date row, organization sections with completion counts, and labeled bottom actions on desktop (icon-only on mobile).
- On mobile, task create/edit now opens as a bottom sheet with drag-to-resize and swipe-down-to-dismiss gestures. Properties are grouped into differentiated card sections on a recessed background, similar to a native grouped list.
- On mobile, the bottom sheet footer action buttons now sit closer to the content above them on both create and edit, with a modest gap above the buttons.
- On desktop, the edit modal uses a right sidebar for task properties and organization fields (projects, subtasks, dependencies) while the main column focuses on title, description, and task information.
- On desktop, the expanded create-task dialog now uses the same two-pane layout as the edit modal, with title and description in the main column and task properties in the right sidebar.
- The title and description fields now show "Title" and "Description" as placeholder text instead of a persisting label above the field.
- Title and description are now the first fields shown in the task modal, with the description appearing directly below the title.
- Removed the duplicate title field from the expanded create-task dialog when using natural-language input; expanding now switches to the same title-and-description layout as the edit modal.
- Clicking contexts or tags in the task modal now opens a compact editor dialog directly instead of showing an intermediate menu. Existing values appear as removable chips, with a separate input and vault autocomplete for adding new ones.
- On mobile, the contexts and tags editor dialogs now use icon-only cancel and confirm buttons on a single row, matching the task modal footer.
- The due date icon is now a target instead of a calendar, to distinguish it from the scheduled date icon.
- Create-task action chips now wrap onto multiple lines instead of scrolling horizontally.
- Scheduled date in the create-task dialog is now a chip alongside the other task properties instead of a separate full-width row.
- In the create-task dialog, property chips now appear on a second row below the natural-language actions.
- Simplified property row labels in the mobile task modal bottom sheet (for example, "Due date" instead of "Set due date") and removed the "Add date" subtitle from empty date rows.

## Fixed

- Fixed the "Add project/subtask/blocked by/blocking" sections in the task modal showing an extra empty header and "+" button alongside the "Add" button when the section had no items.
- Fixed the project/subtask/blocked by/blocking section headers staying clickable when a separate "+" add button was already shown.
- Removed the completed/total counts from project, subtask, and dependency section headers in the task modal.
- Fixed the desktop task edit modal rendering a second, disconnected title field near the bottom of the form.
- Fixed the mobile task modal showing the "Add to project/subtask/blocked by/blocking" sections above the title and description fields instead of below them.
- Fixed the title field appearing clipped on a wide bottom-sheet modal (e.g. a touch-screen device with a wide window), caused by the legacy wide-screen split layout being applied at the same time as the mobile bottom sheet.
- Fixed the desktop task edit modal showing duplicate contexts, tags, and time estimate fields in the main column when they were already shown in the right sidebar.
- Fixed the desktop task edit modal showing subtasks in the main column instead of the right sidebar with the other organization fields.
- Fixed the desktop task edit modal placing project, subtask, and dependency lists at the bottom of the sidebar instead of directly under their property row.
- Fixed the desktop task edit modal sidebar clipping project, subtask, and dependency lists inside a short scroll box instead of letting them grow with their content.
- Fixed misaligned remove buttons in the desktop task edit modal sidebar organization lists.
- Fixed the desktop task edit modal leaving a large empty gap on the right side of the dialog because its content area was capped at a much narrower width than the dialog itself.
- Fixed the desktop task edit modal's content not scrolling, which could squeeze the Save/Cancel buttons in with the rest of the form instead of keeping them pinned to the bottom.
- Fixed the mobile task edit modal action buttons wrapping onto a second row, caused by legacy footer layout rules treating each icon as a separate grid/flex item instead of grouping leading actions and cancel/save into left/right clusters on one row.
- Fixed the mobile bottom sheet drag handle indicator not being centered in its touch target.
- Fixed the Save button in the task modal not showing a full primary accent fill on mobile bottom-sheet layouts.
- Fixed the Task information section in the mobile bottom sheet and desktop edit modal so its section title stays flush with other section headers while metadata rows sit inset inside the grouped card.
- Fixed the Task information section in the mobile bottom sheet using a different card style than the desktop edit modal.
- Fixed the Task information section in the mobile bottom sheet still using Obsidian's generic metadata styles instead of the grouped card layout shown on desktop.
- Fixed repeated console errors when scrolling the mobile task edit modal.
- Fixed the completions calendar month navigation arrows not being visible on mobile, caused by Obsidian hiding SVG icons that are direct children of generic modal buttons.
- Fixed extra horizontal inset on the Completions calendar in the mobile bottom sheet.
- Fixed the Completions and Task information sections in the edit modal showing divider lines that other grouped sections no longer use.
- Fixed missing vertical spacing between the Completions and Task information sections in the edit modal.
- Fixed the Completions and Task information section headers rendering in all caps instead of sentence case.
- Fixed tight spacing between the Completions and Task information section titles and their content in the edit modal.
- Fixed the task modal description field only accepting focus when tapping the first line, instead of anywhere in the description area.
- Fixed missing dividers between some property rows in the mobile task edit bottom sheet.
- Fixed inconsistent divider widths in the mobile task edit bottom sheet by rendering full-width divider elements between property rows instead of relying on row borders across separate grouped cards.
- Fixed the desktop task edit modal sidebar showing "Add to project" and "Add subtask" subtitles on the Projects and Subtasks rows when those sections were empty.
- Fixed the desktop task edit modal sidebar missing its top and bottom border, caused by the panel stretching flush against the scroll container and clipping the border edges.
- Fixed the desktop task edit modal scrollbar sitting flush against the right sidebar instead of leaving a small inset beside it.
- Fixed uneven divider spacing in the desktop task edit modal sidebar after Projects, Subtasks, and dependency rows when those sections were empty.
- Fixed sidebar property row chevrons rendering larger than their row icons and sitting off-center on rows with a value.
- Fixed the mobile task edit modal showing plain "Add to project/subtask/blocked by/blocking" buttons for empty organization sections instead of the icon-and-chevron sidebar rows used on desktop.
- Fixed the mobile task edit modal listing organization and dependency sections after the property rows instead of matching the desktop sidebar order (projects and subtasks first, then properties, then blocked-by and blocking).
- Fixed the mobile task edit modal splitting projects/subtasks, properties, and blocked-by/blocking into separate grouped cards instead of one continuous sidebar-style list.
- Fixed the mobile create/edit bottom sheet staying at the desktop dialog width and leaving large side gutters instead of sizing to its content up to the small-screen maximum.
- Fixed the mobile create/edit bottom sheet expanding flush to the top of the screen when dragged to full height instead of leaving a safe area above the sheet.
- Fixed the mobile create/edit bottom sheet staying behind the on-screen keyboard or formatting toolbar when editing fields. The whole sheet now displaces upward from the bottom edge without changing height.
- Fixed the mobile create/edit bottom sheet footer action buttons scrolling out of view or being clipped when the sheet was partially expanded.
- Fixed the mobile create/edit bottom sheet leaving the content scrollbar inside the padded container instead of along its outer edge.
- Fixed task modal footer buttons so non-save actions use an outlined style while Save stays filled, and icons align vertically with their labels on desktop. Removed Obsidian's default button shadow from footer actions so outlined buttons stay flat.