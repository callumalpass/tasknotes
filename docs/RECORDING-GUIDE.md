# Recording Guide for TaskNotes Documentation

This guide maps every GIF/VIDEO placeholder in the docs to step-by-step recording instructions. Use ScreenToGif for short clips (GIFs) and OBS for longer workflows (VIDEOs).

**Recording setup:**
- Open the `tasknotes-dev-vault` in Obsidian
- Disable Hider plugin (Settings > Community Plugins)
- Use Explorer Hider to hide `.obsidian/` and any irrelevant folders
- Window size: 1200x800 (GIFs) or 1920x1080 (VIDEOs)
- Use the `TaskNotes/Demos/` bases for feature-specific recordings
- Use the `TaskNotes/Views/` bases for core view recordings

**Output:**
- GIFs: `docs/assets/gif-<feature>-<action>.gif` (e.g., `gif-bulk-generate.gif`)
- Videos: `docs/assets/video-<workflow>.mp4`
- Screenshots: `docs/assets/screenshot-<view>.png`

---

## index.md

### GIF: Quick loop showing create task > see it in a view > mark it complete
**File:** `docs/index.md:9`
**Base:** `TaskNotes/Views/All Tasks.base`
**Steps:**
1. Open `All Tasks.base` in Obsidian
2. Press `Ctrl+P` → "TaskNotes: Create new task"
3. Fill: title "Review security report", priority High, due Tomorrow
4. Click Save → task appears in the list
5. Click the status checkbox on the new task → status changes to Done
6. **Duration:** ~8 seconds

### MOCKUP: Hero banner
**File:** `docs/index.md:3`
**Steps:** Composite screenshot — split-screen showing a task note on left and a Bases view on right. Use Obsidian's split pane feature.

### GIF: Quick tour cycling through 3-4 view types
**File:** `docs/index.md:49`
**Bases:** All Tasks, Kanban Board, Calendar, Agenda
**Steps:**
1. Open `All Tasks.base` — pause 2 seconds
2. Switch to Kanban Board tab/view — pause 2 seconds
3. Switch to Calendar — pause 2 seconds
4. Switch to Agenda — pause 2 seconds
5. **Duration:** ~10 seconds

---

## features.md

### GIF: Cycling through different view types
**File:** `docs/features.md:41`
**Same as index.md "Quick tour" above.** Reuse the same recording.

---

## core-concepts.md

### GIF: Opening a .base file and seeing filtered task results
**File:** `docs/core-concepts.md:92`
**Base:** `TaskNotes/Views/All Tasks.base`
**Steps:**
1. Show the file explorer with `TaskNotes/Views/` expanded
2. Click on `All Tasks.base`
3. View loads showing filtered task list
4. **Duration:** ~4 seconds

### GIF: Enabling notifications on a view, or running a bulk action from the toolbar
**File:** `docs/core-concepts.md:117`
**Base:** `TaskNotes/Demos/Notification Demo.base`
**Steps:**
1. Open a .base file in the editor (show YAML)
2. Add `notify: true` to the YAML
3. Switch back to the rendered view
4. Show notification toast appearing
5. Then click "Bulk tasking" in the toolbar
6. **Duration:** ~10 seconds

---

## views/task-list.md

### GIF: Sorting the task list by priority descending, then grouping by status
**File:** `docs/views/task-list.md:101`
**Base:** `TaskNotes/Views/All Tasks.base`
**Steps:**
1. Open All Tasks view
2. Click the Priority column header to sort descending
3. Click the Group button → select "Status"
4. Tasks regroup into status sections
5. **Duration:** ~6 seconds

### GIF: Adding a filter in the .base file YAML and seeing the task list update live
**File:** `docs/views/task-list.md:236`
**Base:** `TaskNotes/Views/All Tasks.base`
**Steps:**
1. Open All Tasks view (rendered)
2. Switch to source mode (Ctrl+E or the edit button)
3. Add a filter line: `- priority == "high"`
4. Switch back to reading mode
5. View updates to show only high-priority tasks
6. **Duration:** ~8 seconds

---

## views/kanban-view.md

### GIF: Dragging a task card from "Open" to "In Progress"
**File:** `docs/views/kanban-view.md:32`
**Base:** `TaskNotes/Views/Kanban Board.base`
**Steps:**
1. Open Kanban Board
2. Find a task in the "pending" column
3. Click and drag it to the "in-progress" column
4. Card snaps into the new column, status updates
5. **Duration:** ~5 seconds

---

## views/calendar-views.md

### GIF: Switching between month, week, and day views
**File:** `docs/views/calendar-views.md:38`
**Base:** `TaskNotes/Views/Calendar.base`
**Steps:**
1. Open Calendar in month view
2. Click "Week" button → view switches
3. Click "Day" button → view switches
4. Click "Month" button → back to month
5. **Duration:** ~8 seconds

### GIF: Dragging a task from one date to another in month view
**File:** `docs/views/calendar-views.md:87`
**Base:** `TaskNotes/Views/Calendar.base`
**Steps:**
1. Open Calendar in month view
2. Find a task on a date
3. Drag it to a different date cell
4. Due date updates, task moves
5. **Duration:** ~5 seconds

---

## views/agenda-view.md

### GIF: Scrolling through the agenda list
**File:** `docs/views/agenda-view.md:37`
**Base:** `TaskNotes/Views/Agenda.base`
**Steps:**
1. Open Agenda view
2. Slowly scroll down showing day groups (Today, Tomorrow, This Week)
3. **Duration:** ~6 seconds

---

## views/upcoming-view.md

### GIF: Scrolling through the Upcoming View
**File:** `docs/views/upcoming-view.md:11`
**Base:** `TaskNotes/Views/Upcoming.base`
**Steps:**
1. Open Upcoming view
2. Scroll showing Overdue, Today, Tomorrow, This Week, Later sections
3. **Duration:** ~6 seconds

### GIF: Clicking through period selectors
**File:** `docs/views/upcoming-view.md:69`
**Base:** `TaskNotes/Views/Upcoming.base`
**Steps:**
1. Open Upcoming view
2. Click Day (D) → view filters to today
3. Click 3 Day (3D) → view expands
4. Click Week (W) → full week shown
5. Click Month (M) → month view
6. **Duration:** ~8 seconds

### GIF: Clicking "Add task" in a section
**File:** `docs/views/upcoming-view.md:88`
**Base:** `TaskNotes/Views/Upcoming.base`
**Steps:**
1. Open Upcoming view
2. Hover over the "Tomorrow" section header
3. Click the "+" or "Add task" button
4. Task creation modal opens with due date pre-filled to tomorrow
5. **Duration:** ~5 seconds

### GIF: Right-clicking a task to reschedule
**File:** `docs/views/upcoming-view.md:96`
**Base:** `TaskNotes/Views/Upcoming.base`
**Steps:**
1. Open Upcoming view
2. Right-click a task in "Today"
3. Context menu appears → hover "Reschedule"
4. Pick "Tomorrow" from submenu
5. Task moves to Tomorrow section
6. **Duration:** ~6 seconds

---

## features/task-management.md

### GIF: Opening the task creation modal
**File:** `docs/features/task-management.md:10`
**Steps:**
1. Press `Ctrl+P` → type "Create new task"
2. Modal opens
3. Fill: title, set due date, set priority to High
4. Click Save
5. **Duration:** ~8 seconds

### GIF: Natural language task description auto-populating fields
**File:** `docs/features/task-management.md:97`
**Steps:**
1. Open task creation modal
2. In title, type "Review PR by Friday high priority"
3. Show fields auto-filling (due: Friday, priority: high)
4. **Duration:** ~6 seconds
5. **Note:** Verify this feature exists before recording

---

## features/inline-tasks.md

### GIF: Hovering over a task wikilink and seeing the overlay
**File:** `docs/features/inline-tasks.md:9`
**Steps:**
1. Open a note that contains `[[Task Name]]` wikilinks
2. Hover over the wikilink
3. Overlay shows status dot, priority, due date, action buttons
4. **Duration:** ~4 seconds

### GIF: Converting a checkbox to a task file
**File:** `docs/features/inline-tasks.md:52`
**Steps:**
1. Open a note with a `- [ ] Buy groceries` checkbox
2. Click the convert icon next to the checkbox
3. Task file is created, checkbox line replaced with `[[Buy groceries]]`
4. **Duration:** ~5 seconds

---

## features/bulk-tasking.md

### GIF: Opening bulk modal, Generate mode, creating tasks
**File:** `docs/features/bulk-tasking.md:17`
**Base:** `TaskNotes/Demos/Bulk Generate Demo.base`
**Steps:**
1. Open Bulk Generate Demo view
2. Click "Bulk tasking" in the toolbar
3. Modal opens on Generate tab
4. Set priority to Normal in the action bar
5. Click "Generate" → progress bar fills
6. Results show "X tasks created"
7. **Duration:** ~10 seconds

### GIF: Convert mode with compatibility check
**File:** `docs/features/bulk-tasking.md:38`
**Base:** `TaskNotes/Demos/Bulk Convert Demo.base`
**Steps:**
1. Open Bulk Convert Demo view
2. Click "Bulk tasking" → switch to "Convert to tasks" tab
3. Compatibility check shows: N convertible, N already tasks, N non-markdown
4. Set status to "pending", priority to "normal"
5. Click "Convert" → progress bar
6. **Duration:** ~10 seconds

### GIF: Edit mode batch-updating
**File:** `docs/features/bulk-tasking.md:63`
**Base:** `TaskNotes/Demos/Bulk Edit Demo.base`
**Steps:**
1. Open Bulk Edit Demo view
2. Click "Bulk tasking" → switch to "Edit existing tasks" tab
3. Set due date to "Next week" in the action bar
4. Set priority to High
5. Click "Edit" → progress bar
6. **Duration:** ~8 seconds

### GIF: Universal Bases view buttons
**File:** `docs/features/bulk-tasking.md:124`
**Steps:**
1. Create or open a plain Bases table view (not a TaskNotes view type)
2. Show the toolbar — "New task" and "Bulk tasking" buttons appear
3. Click "New task" to show it works
4. **Duration:** ~5 seconds

### GIF: Toggling toolbar buttons off
**File:** `docs/features/bulk-tasking.md:135`
**Steps:**
1. Open any Bases view
2. Click the gear (Configure) icon in the toolbar
3. Toggle "Show toolbar buttons" off
4. Buttons disappear from the toolbar
5. **Duration:** ~5 seconds

### GIF: Right-click context menus in Bases views
**File:** `docs/features/bulk-tasking.md:141`
**Steps:**
1. Open a Bases view with mixed content (tasks and non-tasks)
2. Right-click a task row → show full task context menu
3. Right-click a non-task row → show "Convert to task" option
4. **Duration:** ~6 seconds

### GIF: Right-click in File Explorer
**File:** `docs/features/bulk-tasking.md:150`
**Steps:**
1. In the file explorer, select 3-4 files (Shift+click)
2. Right-click → "Bulk tasking (4 files)"
3. Bulk modal opens with those files
4. Then right-click a folder → "Bulk tasking (N files in folder)"
5. **Duration:** ~8 seconds

---

## features/shared-vault.md

### GIF: Registering a device to a person note
**File:** `docs/features/shared-vault.md:25`
**Base:** `TaskNotes/Demos/Shared Vault Demo.base`
**Steps:**
1. Open Settings → TaskNotes → Team
2. Show the "Your Identity" section
3. Click the person picker → select "Cybersader"
4. Device links to the person note
5. **Duration:** ~6 seconds

### GIF: Using the person/group picker in a task modal
**File:** `docs/features/shared-vault.md:93`
**Steps:**
1. Open task creation modal
2. Click the assignee field
3. Person/group picker opens — show persons and groups listed
4. Select "Alice Chen" → assignee populated
5. **Duration:** ~6 seconds

---

## features/reminders.md

### GIF: Adding a reminder to a task
**File:** `docs/features/reminders.md:37`
**Base:** `TaskNotes/Demos/Reminders Demo.base`
**Steps:**
1. Open a task with a due date
2. Click the bell icon
3. Reminder editor opens
4. Select "15 minutes before due"
5. Reminder indicator (dot) appears on the bell
6. **Duration:** ~6 seconds

### GIF: Reminder notification firing
**File:** `docs/features/reminders.md:105`
**Steps:**
1. Set up a task with a reminder due in the next minute (for recording)
2. Wait for the notification toast to appear
3. Show the Obsidian notice with task name and action buttons
4. **Duration:** ~8 seconds
5. **Note:** May need to manipulate system time or set a very short reminder

---

## features/recurring-tasks.md

### GIF: Creating a recurring task and completing an occurrence
**File:** `docs/features/recurring-tasks.md:19`
**Base:** `TaskNotes/Demos/Recurring Tasks Demo.base`
**Steps:**
1. Open task creation modal
2. Set recurrence to "Every weekday"
3. Save → task appears in the list
4. Click to complete the task
5. Scheduled date advances to next weekday
6. **Duration:** ~8 seconds

---

## features/calendar-integration.md

### GIF: Dragging a task to a new date in calendar week view
**File:** `docs/features/calendar-integration.md:10`
**Base:** `TaskNotes/Views/Calendar.base`
**Steps:**
1. Open Calendar in week view
2. Drag a task from Tuesday to Thursday
3. Due date updates
4. **Duration:** ~5 seconds

### GIF: Clicking and dragging on a calendar time slot to create a time entry
**File:** `docs/features/calendar-integration.md:50`
**Base:** `TaskNotes/Views/Calendar.base`
**Steps:**
1. Open Calendar in week view (day or week with time slots)
2. Click and drag on a time slot (e.g., 10:00-11:00)
3. Time entry creation prompt appears linked to a task
4. **Duration:** ~6 seconds

---

## features/custom-properties.md

### GIF: Clicking scope chips
**File:** `docs/features/custom-properties.md:37`
**Base:** `TaskNotes/Demos/Custom Properties Demo.base`
**Steps:**
1. Open a task modal
2. Click "Properties" to expand the PropertyPicker
3. Click "This note" chip → shows properties on this file
4. Click "View items" chip → shows properties from the view
5. Click "All tasks" → broader scope
6. Click "All files" → everything
7. **Duration:** ~8 seconds

### GIF: Searching for a property and adding it
**File:** `docs/features/custom-properties.md:56`
**Steps:**
1. In the PropertyPicker search box, type "effort"
2. "effort" appears in results with type badge "number"
3. Click it → appears as editable row below
4. Type "90" in the value field
5. **Duration:** ~6 seconds

### GIF: Mapping a custom property to a date field
**File:** `docs/features/custom-properties.md:90`
**Steps:**
1. In the PropertyPicker, find a custom date property
2. Click "Map to" → select "Use as Due date"
3. Value picker switches from text to a date picker
4. **Duration:** ~5 seconds

---

## features/per-base-mapping.md

### GIF: Creating a task from a mapped view
**File:** `docs/features/per-base-mapping.md:31`
**Base:** `TaskNotes/Demos/Per-View Mapping Demo.base`
**Steps:**
1. Open Per-View Mapping Demo
2. Click "New task" in the toolbar
3. Task modal opens with PropertyPicker pre-populated with mapped fields
4. Show field labels using mapped names (Deadline, Owner, Initiative)
5. **Duration:** ~6 seconds

### GIF: Setting up field mappings in Configure panel
**File:** `docs/features/per-base-mapping.md:57`
**Steps:**
1. Open any Bases view
2. Click the gear (Configure) icon
3. Scroll to "Field Mappings" section
4. Add a mapping: "deadline" → "due"
5. Save → view updates column headers
6. **Duration:** ~8 seconds

---

## features/bases-notifications.md

### GIF: Adding notify: true and seeing toast
**File:** `docs/features/bases-notifications.md:20`
**Base:** `TaskNotes/Demos/Notification Demo.base`
**Steps:**
1. Open a .base file in source mode
2. Add `notify: true` to the view definition
3. Switch to reading mode
4. Toast notification appears showing matched items
5. **Duration:** ~8 seconds

### GIF: Toast with snooze dropdown
**File:** `docs/features/bases-notifications.md:56`
**Steps:**
1. Trigger a notification toast (open a view with notify: true and matching items)
2. Toast shows item breakdown
3. Click snooze dropdown
4. Select "1 hour" or "Until tomorrow"
5. Toast dismisses
6. **Duration:** ~6 seconds

---

## features/user-fields.md

### GIF: Adding a new user field in settings
**File:** `docs/features/user-fields.md:10`
**Steps:**
1. Open Settings → TaskNotes → Task Properties
2. Scroll to "User fields" or custom fields section
3. Click "Add field" → type "effort_hours", set type to Number
4. Save
5. Open task creation modal → "Effort hours" field appears
6. **Duration:** ~8 seconds

### GIF: Filtering a Bases view by a custom user field
**File:** `docs/features/user-fields.md:121`
**Steps:**
1. Open a Bases view
2. Click the filter button
3. Add filter: "effort_hours > 2"
4. View filters to only high-effort tasks
5. **Duration:** ~6 seconds

---

## features/time-management.md

### GIF: Starting and stopping the time tracker
**File:** `docs/features/time-management.md:7`
**Base:** `TaskNotes/Demos/Time Tracking Demo.base`
**Steps:**
1. Open a task card or task note
2. Click the play/timer button
3. Timer starts counting
4. Wait 3-5 seconds
5. Click stop → time entry recorded
6. **Duration:** ~8 seconds

### GIF: Pomodoro session
**File:** `docs/features/time-management.md:38`
**Steps:**
1. Open a task → click Pomodoro button
2. Timer starts (25:00 countdown shown)
3. Speed up or cut to timer finishing
4. Break prompt appears
5. **Duration:** ~10 seconds (with cuts)

---

## features/property-migration.md

### GIF: Changing a property name and running migration
**File:** `docs/features/property-migration.md:9`
**Steps:**
1. Open Settings → TaskNotes → Task Properties
2. Change "due" display name to "deadline"
3. Migration prompt appears: "X files use the old property name"
4. Click "Migrate all"
5. Progress indicator → "Done: X files updated"
6. **Duration:** ~8 seconds

### GIF: Migration command from palette
**File:** `docs/features/property-migration.md:52`
**Steps:**
1. Press `Ctrl+P` → type "Migrate"
2. Select "TaskNotes: Rename property key"
3. Enter old name, new name, scope
4. Click "Run" → files updated
5. **Duration:** ~8 seconds

---

## features/contributing.md

### GIF: Running bun run dev with Hot Reload
**File:** `docs/contributing.md:23`
**Steps:**
1. Show terminal with `bun run dev` running
2. Edit a source file (e.g., change a string in a modal)
3. Obsidian auto-reloads the plugin
4. Show the change reflected in the UI
5. **Duration:** ~10 seconds

---

## workflows.md

### VIDEO: Full setup walkthrough
**File:** `docs/workflows.md:5`
**Duration:** 3-5 minutes
**Steps:**
1. Fresh Obsidian vault with TaskNotes just installed
2. Enable Bases core plugin
3. Open Settings → TaskNotes → run "Create default files"
4. Open All Tasks view — empty
5. Create first task via command palette
6. Task appears in view
7. Open Kanban Board — same task shown
8. Mark task complete
9. Show it move to "done" column

### VIDEO: Recurring tasks workflow
**File:** `docs/workflows.md:9`
**Duration:** 2-3 minutes
**Base:** `TaskNotes/Demos/Recurring Tasks Demo.base`
**Steps:**
1. Create recurring task "Weekly standup" with FREQ=WEEKLY
2. Open Calendar → show it appearing every week
3. Complete one occurrence → next date advances
4. Show completion pattern across weeks

### VIDEO: Project setup workflow
**File:** `docs/workflows.md:31`
**Duration:** 3-4 minutes
**Base:** `TaskNotes/Demos/Custom Properties Demo.base`
**Steps:**
1. Create project notes (Project Alpha, Project Beta)
2. Create tasks linked to projects via `projects` field
3. Open a Bases view filtered by project
4. Save as a custom .base file
5. Show project-specific view

### VIDEO: Daily workflow
**File:** `docs/workflows.md:55`
**Duration:** 3-4 minutes
**Steps:**
1. Open Upcoming View → morning review of overdue/today items
2. Drag tasks in Calendar to schedule
3. Work on tasks → complete several
4. End of day → Agenda shows remaining items

### VIDEO: Weekly review
**File:** `docs/workflows.md:65`
**Duration:** 2-3 minutes
**Base:** `TaskNotes/Demos/Completed Tasks Demo.base`
**Steps:**
1. Open Completed Tasks Demo → review what was done
2. Open Recurring Tasks Demo → check patterns
3. Open Priority Dashboard → rebalance upcoming work

### VIDEO: Meeting notes to tasks
**File:** `docs/workflows.md:73`
**Duration:** 2-3 minutes
**Base:** `TaskNotes/Demos/Bulk Generate Demo.base`
**Steps:**
1. Open a meeting notes file with action items
2. Right-click in file explorer → Bulk tasking
3. Generate tasks linked to the meeting note
4. Open project view → new tasks appear

### VIDEO: Shared vault two-device setup
**File:** `docs/workflows.md:81`
**Duration:** 3-4 minutes
**Base:** `TaskNotes/Demos/Shared Vault Demo.base`
**Steps:**
1. Device A: Register identity as "Cybersader"
2. Device B: Register identity as "Alice Chen"
3. Create a task on Device A → auto-attributed to Cybersader
4. Open Shared Vault Demo → filter by assignee
5. Show each person sees their own tasks highlighted

### VIDEO: Notification-driven review workflow
**File:** `docs/workflows.md:89`
**Duration:** 2-3 minutes
**Base:** `TaskNotes/Demos/Notification Demo.base`
**Steps:**
1. Set up Notification Demo with `notify: true`
2. Toast appears showing urgent items
3. Click through to Upcoming View
4. Resolve items one by one
5. Notification count decreases

---

## Summary: Base-to-Doc Mapping

| Demo Base | Docs Using It |
|-----------|---------------|
| Bulk Generate Demo | bulk-tasking.md (Generate mode) |
| Bulk Convert Demo | bulk-tasking.md (Convert mode) |
| Bulk Edit Demo | bulk-tasking.md (Edit mode) |
| Notification Demo | bases-notifications.md, core-concepts.md, workflows.md |
| Recurring Tasks Demo | recurring-tasks.md, workflows.md |
| Reminders Demo | reminders.md |
| Custom Properties Demo | custom-properties.md, workflows.md |
| Time Tracking Demo | time-management.md |
| Shared Vault Demo | shared-vault.md, workflows.md |
| Per-View Mapping Demo | per-base-mapping.md |
| Project Dependencies Demo | task-management.md |
| Completed Tasks Demo | task-management.md, workflows.md |
| Priority Dashboard Demo | views.md, core-concepts.md |
| Statistics Demo | views.md |
| Document Library | bulk-tasking.md |
| Documents Coming Due | bases-notifications.md |
| Tasks by Assignee | shared-vault.md |
| Team Workload | shared-vault.md |
| All Tasks | index.md, core-concepts.md, task-list.md |
| Kanban Board | kanban-view.md, index.md |
| Calendar | calendar-views.md, calendar-integration.md |
| Agenda | agenda-view.md, index.md |
| Upcoming | upcoming-view.md |
| Mini Calendar | calendar-views.md |
| Relationships | inline-tasks.md |
