# Workflow Examples

[← Back to Workflows](workflows.md)

Guided tutorials for common TaskNotes scenarios. Each section includes GIFs of the key steps and a video walkthrough as the centerpiece. For the conceptual framework behind these workflows, see [Workflows](workflows.md).

> [!tip] Before recording or following along
> Run `node scripts/generate-test-data.mjs --clean` in the plugin folder to get clean, realistic demo data. See the [Workflows recording script](workflows.md) for full setup instructions.

---

## Getting Started

> Your first task in under 60 seconds.

If you have just installed TaskNotes and want to see it work end-to-end, this is the place to start. You will create a task, see it appear in a view, and complete it.

<!-- GIF: Opening the command palette and running "TaskNotes: Create task" -->

<!-- GIF: Filling in title and due date in the task creation modal, then saving -->

<!-- GIF: Opening the Upcoming View and seeing the new task appear under "Today" -->

<!-- VIDEO: Full walkthrough of setting up TaskNotes from scratch — creating first task, opening a view, completing a task -->

![workflow first task walkthrough](assets/workflow-examples/workflow-first-task-walkthrough.mp4)

**What you will learn:** Task creation modal, Upcoming View, task completion flow.

Mode: All — this covers the basics every workflow builds on.

---

## Daily Task Management

> Morning review, schedule placement, and end-of-day wrap-up.

Start the day in Upcoming View to see what is overdue and what is due today. Drag tasks into the Calendar to timebox your afternoon. During a meeting, jot checkboxes and convert them to tasks inline. At end of day, check the Agenda for what is left.

<!-- GIF: Scrolling through the Upcoming View — overdue (red), today (green), tomorrow, later sections -->

<!-- GIF: Dragging a task from Upcoming into a Calendar time slot to schedule it -->

<!-- GIF: Converting a checkbox in a meeting note to a tracked task using inline conversion -->

<!-- VIDEO: A day in TaskNotes — morning review in Upcoming View, scheduling in Calendar, completing tasks, ending with the Agenda -->

**What you will learn:** [Upcoming View](views/upcoming-view.md), [Calendar views](views/calendar-views.md), [Inline task conversion](features/inline-tasks.md), [Agenda View](views/agenda-view.md).

Mode: [Capture & Execute](workflows.md#capture--execute)

---

## Habit Tracking with Recurring Tasks

> Build streaks and track consistency over time.

Create a recurring task from natural language ("Exercise daily") or configure recurrence in the task modal. Mark completion per occurrence in the recurrence calendar. Review streaks in Calendar view — green dots for completed days, gaps for missed ones.

<!-- GIF: Creating a recurring task with "every weekday" in the task creation modal -->

<!-- GIF: Marking today's occurrence as complete in the recurrence calendar, seeing the streak build -->

<!-- VIDEO: Creating a recurring task with natural language, marking completions in the calendar, reviewing completion patterns -->

**What you will learn:** [Recurring tasks](features/recurring-tasks.md), completion tracking, [Calendar views](views/calendar-views.md).

Mode: [Rhythm & Habits](workflows.md#rhythm--habits)

---

## Project-Centered Planning

> Link tasks to projects, filter views by initiative, and manage multi-deliverable work.

Projects in TaskNotes are wikilinks to project notes. Create a project note, link tasks to it via the project picker, then filter a Task List or Kanban to that project. Save the filter as a Bases view for quick access.

<!-- GIF: Using the project picker in the task creation modal to link a task to a project note -->

<!-- GIF: Filtering a Task List view by project using a Bases filter expression -->

<!-- GIF: Opening a Kanban board filtered to one project, showing task cards flowing through status columns -->

<!-- VIDEO: Setting up a project view — creating project notes, linking tasks, filtering by project, saving the view -->

**What you will learn:** [Projects](features/task-management.md#projects), [Task List View](views/task-list.md), [Kanban View](views/kanban-view.md), Bases filters.

Mode: [Orchestration](workflows.md#orchestration)

---

## Weekly Review

> Clean up, check patterns, and rebalance for the week ahead.

A weekly review usually includes three steps: clean up completed or archived tasks, verify recurring-task completion patterns, and rebalance project filters and views. If calendar integrations are enabled, this is also a good point to refresh subscriptions and confirm sync health.

<!-- GIF: Filtering the Task List to completed tasks and archiving them in batch -->

<!-- GIF: Opening a Calendar view to check recurring task streaks for the past week -->

<!-- VIDEO: Weekly review workflow — cleaning up completed tasks, checking recurring patterns, rebalancing project views -->

**What you will learn:** Task archiving, [recurring tasks](features/recurring-tasks.md) streak review, [Calendar views](views/calendar-views.md).

Modes: [Rhythm & Habits](workflows.md#rhythm--habits) + [Capture & Execute](workflows.md#capture--execute)

---

## Bulk Tasking from Meeting Notes

> Turn action items into tracked tasks without leaving the meeting note.

After a meeting, you have a note full of action items. Open it in a Bases view (or right-click it in the file explorer) and use Bulk tasking. Generate mode creates a task file for each item and links it back to the meeting note. Set a due date and assignee in the action bar — they apply to every generated task at once.

<!-- GIF: Right-clicking a meeting note in the file explorer and opening the bulk tasking modal -->

<!-- GIF: Setting due date and assignee in the action bar, then clicking Generate to create linked tasks -->

<!-- VIDEO: Writing meeting notes, selecting action items, bulk-generating linked tasks, then viewing them in the project's Bases view -->

**What you will learn:** [Bulk Tasking](features/bulk-tasking.md) (Generate mode), action bar, project linking.

Modes: [Capture & Execute](workflows.md#capture--execute) + [Records & Registers](workflows.md#records--registers)

---

## Team Workflow in a Shared Vault

> Register devices, auto-attribute tasks, and filter notifications by person.

In a shared vault, each person registers their device to a person note once. After that, TaskNotes auto-attributes every task you create. The person/group picker makes assignment fast. Enable "Only notify for my tasks" so each person only sees their own notifications.

<!-- GIF: Registering a device to a person note in the Team & Attribution settings -->

<!-- GIF: Assigning a task to a team member using the person/group picker in the task modal -->

<!-- VIDEO: Two devices opening the same vault — registering identities, creating tasks with auto-attribution, filtering notifications by assignee -->

**What you will learn:** [Team & Attribution](features/shared-vault.md), person/group picker, notification filtering.

Mode: [Orchestration](workflows.md#orchestration)

---

## Notification-Driven Triage

> Let views tell you what needs attention instead of checking manually.

Create a Bases view filtered to tasks that need attention — overdue items, tasks without assignees, or items flagged for review. Add `notify: true` to the view's YAML. TaskNotes watches the query and surfaces a toast when items match. Click the toast to triage.

<!-- GIF: Adding notify: true to a .base file's YAML -->

<!-- GIF: Toast notification appearing with item count, clicking through to the Upcoming View -->

<!-- VIDEO: Setting up notify: true on a "Needs Review" view, seeing the toast appear, clicking through to the Upcoming View, and resolving items -->

**What you will learn:** [View Notifications](features/bases-notifications.md), `.base` file configuration, triage workflow.

Modes: [Orchestration](workflows.md#orchestration) + [Records & Registers](workflows.md#records--registers)

---

## Document Review Library

> Maintain a register of documents that drives its own task list.

Set up a folder of documents with frontmatter properties like `review_date`, `review_cycle`, and `owner`. Create a Bases view that filters to documents where the review date has passed. Use Bulk Convert to turn overdue documents into tracked tasks in place, or Bulk Generate to create separate review task files. Add recurring tasks to enforce review cadence.

<!-- GIF: Creating a Bases view filtered to documents where review_date is past -->

<!-- GIF: Using Bulk Convert to add task metadata to existing document notes -->

<!-- GIF: Setting up a recurring review task linked to the document library -->

<!-- VIDEO: Records & Registers workflow — browsing a document review register, filtering overdue reviews, bulk-converting review tasks -->

**What you will learn:** [Bulk Tasking](features/bulk-tasking.md) (Convert + Generate modes), [Property Mapping](features/property-mapping.md), [Recurring tasks](features/recurring-tasks.md), Bases views as registers.

Mode: [Records & Registers](workflows.md#records--registers)
