---
title: Default Base Templates
description: Default base file templates for TaskNotes views
dateModified: 2026-05-17T21:57:48+1000
---

# Default Base Templates

TaskNotes automatically generates [Bases](https://help.obsidian.md/Bases/Introduction+to+Bases) files for its built-in views when you first open them. These templates are configured based on your TaskNotes settings, including custom property names, statuses, and task identification methods.

This page shows the default templates as they would appear with TaskNotes' default settings. The actual templates generated in your vault may differ if you've customized your settings.
This page documents generated defaults. It is reference material for understanding and editing `.base` files already created in your vault.

Generated `.base` files are regular vault files. When you change task identification, field mapping, status, or priority settings, existing files keep their current content until you edit them. To replace the configured default files with templates generated from your current settings, use **Settings → TaskNotes → Views & base files → Update files** or run the **TaskNotes: Update default base files** command. Automation clients can call `api.bases.updateDefaultFiles()` from the runtime API or `POST /api/bases/default-files/update` from the local HTTP API. These update actions overwrite the configured default `.base` files, including any manual edits in those files.

## Default settings assumptions

The examples below assume:

- **Task identification**: Tag-based using `#task`
- **Field mapping**: Default property names (e.g., `status`, `due`, `scheduled`, `projects`, `contexts`)
- **Statuses**: `none`, `open`, `in-progress`, `done` (only `done` is completed)
- **Priorities**: `none`, `low`, `normal`, `high` (sorted by weight)
- **Visible properties**: `status`, `priority`, `due`, `scheduled`, `projects`, `contexts`, `tags`, `blocked`, `blocking`

When task identification uses a property instead of a tag, generated filters reference the identifying note property with bracket notation, such as `note["Task Type"] == true`. This keeps filters valid when custom property names contain spaces or other characters that cannot be used with dot notation.

## Included formulas

All templates include the following calculated formula properties that you can use in views, filters, and sorting.
The formula set is broad so views can reuse shared computed properties without custom plugin code.

### Date calculations

| Formula | Description | Expression |
|---------|-------------|------------|
| `daysUntilDue` | Days until due date (negative = overdue, positive = days remaining, null if no due date) | `if((due.isEmpty() == false), ((number(date(due)) - number(today())) / 86400000).floor(), null)` |
| `dueIn` | Compact due date countdown for agenda/list displays | `if(due.isEmpty(), "", if(formula.daysUntilDue == 0, "Today", if(formula.daysUntilDue == 1, "1 day", if(formula.daysUntilDue > 1, formula.daysUntilDue + " days", if(formula.daysUntilDue == -1, "1 day overdue", formula.daysUntilDue * -1 + " days overdue")))))` |
| `daysUntilScheduled` | Days until scheduled date (negative = past, positive = days remaining, null if no scheduled date) | `if((scheduled.isEmpty() == false), ((number(date(scheduled)) - number(today())) / 86400000).floor(), null)` |
| `daysSinceCreated` | Number of days since the task file was created | `((number(now()) - number(file.ctime)) / 86400000).floor()` |
| `daysSinceModified` | Number of days since the task file was last modified | `((number(now()) - number(file.mtime)) / 86400000).floor()` |

### Boolean formulas

| Formula | Description | Expression |
|---------|-------------|------------|
| `isOverdue` | True if task has a past due date and is not completed | `(due.isEmpty() == false) && date(due) < today() && status != "done"` |
| `isDueToday` | True if task is due today | `(due.isEmpty() == false) && date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")` |
| `isDueThisWeek` | True if task is due within the next 7 days | `(due.isEmpty() == false) && date(due).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD") && date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")` |
| `isScheduledToday` | True if task is scheduled for today | `(scheduled.isEmpty() == false) && date(scheduled).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")` |
| `isRecurring` | True if task has a recurrence rule | `recurrence && !recurrence.isEmpty()` |
| `hasTimeEstimate` | True if task has a time estimate > 0 | `timeEstimate && timeEstimate > 0` |

### Time tracking

| Formula | Description | Expression |
|---------|-------------|------------|
| `timeRemaining` | Time estimate minus time tracked (in minutes), null if no estimate | `if(timeEstimate && timeEstimate > 0, timeEstimate - if(timeEntries, list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0), 0), null)` |
| `efficiencyRatio` | Percentage of estimated time used (>100% = took longer, <100% = faster, null if no estimate) | `if(timeEstimate && timeEstimate > 0 && timeEntries, (list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) / timeEstimate * 100).round(), null)` |
| `timeTrackedThisWeek` | Total minutes tracked in the last 7 days | `if(timeEntries, list(timeEntries).filter(value.endTime && date(value.startTime) >= today() - "7d").map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)` |
| `timeTrackedToday` | Total minutes tracked today | `if(timeEntries, list(timeEntries).filter(value.endTime && date(value.startTime).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)` |

### Grouping formulas

These formulas return string values useful for grouping tasks in views:

| Formula | Description | Example values | Expression |
|---------|-------------|----------------|------------|
| `dueMonth` | Due date as year-month | "2025-01", "No due date" | `if((due.isEmpty() == false), date(due).format("YYYY-MM"), "No due date")` |
| `dueWeek` | Due date as year-week | "2025-W01", "No due date" | `if((due.isEmpty() == false), date(due).format("YYYY-[W]WW"), "No due date")` |
| `scheduledMonth` | Scheduled date as year-month | "2025-01", "Not scheduled" | `if((scheduled.isEmpty() == false), date(scheduled).format("YYYY-MM"), "Not scheduled")` |
| `scheduledWeek` | Scheduled date as year-week | "2025-W01", "Not scheduled" | `if((scheduled.isEmpty() == false), date(scheduled).format("YYYY-[W]WW"), "Not scheduled")` |
| `dueDateCategory` | Human-readable due date bucket | "Overdue", "Today", "Tomorrow", "This week", "Later", "No due date" | `if(due.isEmpty(), "No due date", if(date(due) < today(), "Overdue", if(date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD"), "Today", if(date(due).format("YYYY-MM-DD") == (today() + "1 day").format("YYYY-MM-DD"), "Tomorrow", if(date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD"), "This week", "Later")))))` |
| `timeEstimateCategory` | Task size by time estimate | "No estimate", "Quick (<30m)", "Medium (30m-2h)", "Long (>2h)" | `if(!timeEstimate \|\| timeEstimate == 0 \|\| timeEstimate == null, "No estimate", if(timeEstimate < 30, "Quick (<30m)", if(timeEstimate <= 120, "Medium (30m-2h)", "Long (>2h)")))` |
| `ageCategory` | Task age bucket | "Today", "This week", "This month", "Older" | `if(((number(now()) - number(file.ctime)) / 86400000) < 1, "Today", if(((number(now()) - number(file.ctime)) / 86400000) < 7, "This week", if(((number(now()) - number(file.ctime)) / 86400000) < 30, "This month", "Older")))` |
| `createdMonth` | Creation date as year-month | "2025-01" | `file.ctime.format("YYYY-MM")` |
| `modifiedMonth` | Last modified date as year-month | "2025-01" | `file.mtime.format("YYYY-MM")` |
| `priorityCategory` | Priority as readable label | "High", "Normal", "Low", "No priority" | `if(priority=="high","High",if(priority=="normal","Normal",if(priority=="low","Low","No priority")))` |
| `projectCount` | Number of assigned projects | "No projects", "Single project", "Multiple projects" | `if(!projects \|\| list(projects).length == 0, "No projects", if(list(projects).length == 1, "Single project", "Multiple projects"))` |
| `contextCount` | Number of assigned contexts | "No contexts", "Single context", "Multiple contexts" | `if(!contexts \|\| list(contexts).length == 0, "No contexts", if(list(contexts).length == 1, "Single context", "Multiple contexts"))` |
| `trackingStatus` | Time tracking vs estimate | "No estimate", "Not started", "Under estimate", "Over estimate" | `if(!timeEstimate \|\| timeEstimate == 0 \|\| timeEstimate == null, "No estimate", if(!timeEntries \|\| list(timeEntries).length == 0, "Not started", if(formula.efficiencyRatio < 100, "Under estimate", "Over estimate")))` |

### Combined due/scheduled formulas

These formulas work with either due date or scheduled date, useful for finding the "next action date":

| Formula | Description | Example values | Expression |
|---------|-------------|----------------|------------|
| `nextDate` | The earlier of due or scheduled date | Date value or null | `if((due.isEmpty() == false) && (scheduled.isEmpty() == false), if(date(due) < date(scheduled), due, scheduled), if((due.isEmpty() == false), due, scheduled))` |
| `daysUntilNext` | Days until next date (due or scheduled, whichever is sooner) | -2, 0, 5, null | `if((due.isEmpty() == false) && (scheduled.isEmpty() == false), min(formula.daysUntilDue, formula.daysUntilScheduled), if((due.isEmpty() == false), formula.daysUntilDue, formula.daysUntilScheduled))` |
| `hasDate` | True if task has either a due or scheduled date | true, false | `(due.isEmpty() == false) \|\| (scheduled.isEmpty() == false)` |
| `isToday` | True if due OR scheduled today | true, false | `((due.isEmpty() == false) && date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")) \|\| ((scheduled.isEmpty() == false) && date(scheduled).format("YYYY-MM-DD") == today().format("YYYY-MM-DD"))` |
| `isThisWeek` | True if due OR scheduled within 7 days | true, false | `((due.isEmpty() == false) && date(due).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD") && date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")) \|\| ((scheduled.isEmpty() == false) && date(scheduled).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD") && date(scheduled).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD"))` |
| `nextDateCategory` | Human-readable bucket for next date | "Overdue/Past", "Today", "Tomorrow", "This week", "Later", "No date" | `if(due.isEmpty() && scheduled.isEmpty(), "No date", if(((due.isEmpty() == false) && date(due) < today()) \|\| ((scheduled.isEmpty() == false) && date(scheduled) < today()), "Overdue/Past", if(((due.isEmpty() == false) && date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")) \|\| ((scheduled.isEmpty() == false) && date(scheduled).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")), "Today", if(((due.isEmpty() == false) && date(due).format("YYYY-MM-DD") == (today() + "1 day").format("YYYY-MM-DD")) \|\| ((scheduled.isEmpty() == false) && date(scheduled).format("YYYY-MM-DD") == (today() + "1 day").format("YYYY-MM-DD")), "Tomorrow", if(((due.isEmpty() == false) && date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")) \|\| ((scheduled.isEmpty() == false) && date(scheduled).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")), "This week", "Later")))))` |
| `nextDateMonth` | Next date as year-month | "2025-01", "No date" | `if((due.isEmpty() == false) && (scheduled.isEmpty() == false), if(date(due) < date(scheduled), date(due).format("YYYY-MM"), date(scheduled).format("YYYY-MM")), if((due.isEmpty() == false), date(due).format("YYYY-MM"), if((scheduled.isEmpty() == false), date(scheduled).format("YYYY-MM"), "No date")))` |
| `nextDateWeek` | Next date as year-week | "2025-W01", "No date" | `if((due.isEmpty() == false) && (scheduled.isEmpty() == false), if(date(due) < date(scheduled), date(due).format("YYYY-[W]WW"), date(scheduled).format("YYYY-[W]WW")), if((due.isEmpty() == false), date(due).format("YYYY-[W]WW"), if((scheduled.isEmpty() == false), date(scheduled).format("YYYY-[W]WW"), "No date")))` |

### Sorting

| Formula | Description | Expression |
|---------|-------------|------------|
| `priorityWeight` | Numeric weight for priority sorting (lower = higher priority) | `if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))` |
| `urgencyScore` | Combines priority, next date proximity, and time-of-day (due or scheduled, higher = more urgent) | `if(due.isEmpty() && scheduled.isEmpty(), formula.priorityWeight, formula.priorityWeight + max(0, 10 - if(formula.daysUntilNext, formula.daysUntilNext, 0)) + (1 - ((number(date(formula.nextDate)) - number(date(date(formula.nextDate).format("YYYY-MM-DD")))) / 86400000)))` |

### Display formulas

| Formula | Description | Example values | Expression |
|---------|-------------|----------------|------------|
| `timeTrackedFormatted` | Total time tracked as readable text | "2h 30m", "45m", "0m" | `if(timeEntries, if(list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) >= 60, (list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) / 60).floor() + "h " + (list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) % 60).round() + "m", list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round() + "m"), "0m")` |
| `dueDateDisplay` | Due date as relative text | "Today", "Tomorrow", "Yesterday", "3d ago", "Mon", "Dec 15" | `if(due.isEmpty(), "", if(date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD"), "Today", if(date(due).format("YYYY-MM-DD") == (today() + "1 day").format("YYYY-MM-DD"), "Tomorrow", if(date(due).format("YYYY-MM-DD") == (today() - "1 day").format("YYYY-MM-DD"), "Yesterday", if(date(due) < today(), formula.daysUntilDue * -1 + "d ago", if(date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD"), date(due).format("ddd"), date(due).format("MMM D")))))))` |

## Mini Calendar

Used by the **Mini Calendar** command to display tasks on a calendar grid.
YAML examples in this document are complete snapshots. In custom files, targeted edits (for example `dateProperty`, `sort`, or a filter clause) are easier to compare and troubleshoot.

```yaml
# Mini Calendar
# Generated with your TaskNotes settings

filters:
  and:
    - file.hasTag("task")

formulas:
  # Sorting
  priorityWeight: 'if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))'
  urgencyScore: 'if(due.isEmpty(), formula.priorityWeight, formula.priorityWeight + max(0, 10 - formula.daysUntilDue))'
  # Date calculations
  daysUntilDue: 'if((due.isEmpty() == false), ((number(date(due)) - number(today())) / 86400000).floor(), null)'
  dueIn: 'if(due.isEmpty(), "", if(formula.daysUntilDue == 0, "Today", if(formula.daysUntilDue == 1, "1 day", if(formula.daysUntilDue > 1, formula.daysUntilDue + " days", if(formula.daysUntilDue == -1, "1 day overdue", formula.daysUntilDue * -1 + " days overdue")))))'
  daysUntilScheduled: 'if((scheduled.isEmpty() == false), ((number(date(scheduled)) - number(today())) / 86400000).floor(), null)'
  daysSinceCreated: '((number(now()) - number(file.ctime)) / 86400000).floor()'
  daysSinceModified: '((number(now()) - number(file.mtime)) / 86400000).floor()'
  # Booleans
  isOverdue: '(due.isEmpty() == false) && date(due) < today() && status != "done"'
  isDueToday: '(due.isEmpty() == false) && date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")'
  isDueThisWeek: '(due.isEmpty() == false) && date(due).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD") && date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")'
  isScheduledToday: '(scheduled.isEmpty() == false) && date(scheduled).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")'
  isRecurring: 'recurrence && !recurrence.isEmpty()'
  hasTimeEstimate: 'timeEstimate && timeEstimate > 0'
  # Time tracking
  timeRemaining: 'if(timeEstimate && timeEstimate > 0, timeEstimate - if(timeEntries, list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0), 0), null)'
  efficiencyRatio: 'if(timeEstimate && timeEstimate > 0 && timeEntries, (list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) / timeEstimate * 100).round(), null)'
  timeTrackedThisWeek: 'if(timeEntries, list(timeEntries).filter(value.endTime && date(value.startTime) >= today() - "7d").map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)'
  timeTrackedToday: 'if(timeEntries, list(timeEntries).filter(value.endTime && date(value.startTime).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)'
  timeTrackedFormatted: '...'  # Formats total tracked time as "Xh Ym"
  # Grouping
  dueMonth: 'if((due.isEmpty() == false), date(due).format("YYYY-MM"), "No due date")'
  dueWeek: 'if((due.isEmpty() == false), date(due).format("YYYY-[W]WW"), "No due date")'
  scheduledMonth: 'if((scheduled.isEmpty() == false), date(scheduled).format("YYYY-MM"), "Not scheduled")'
  scheduledWeek: 'if((scheduled.isEmpty() == false), date(scheduled).format("YYYY-[W]WW"), "Not scheduled")'
  dueDateCategory: 'if(due.isEmpty(), "No due date", if(date(due) < today(), "Overdue", if(date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD"), "Today", if(date(due).format("YYYY-MM-DD") == (today() + "1 day").format("YYYY-MM-DD"), "Tomorrow", if(date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD"), "This week", "Later")))))'
  dueDateDisplay: '...'  # Shows "Today", "Tomorrow", "3d ago", "Mon", "Dec 15"
  timeEstimateCategory: 'if(!timeEstimate || timeEstimate == 0 || timeEstimate == null, "No estimate", if(timeEstimate < 30, "Quick (<30m)", if(timeEstimate <= 120, "Medium (30m-2h)", "Long (>2h)")))'
  ageCategory: 'if(((number(now()) - number(file.ctime)) / 86400000) < 1, "Today", if(((number(now()) - number(file.ctime)) / 86400000) < 7, "This week", if(((number(now()) - number(file.ctime)) / 86400000) < 30, "This month", "Older")))'
  createdMonth: 'file.ctime.format("YYYY-MM")'
  modifiedMonth: 'file.mtime.format("YYYY-MM")'
  priorityCategory: 'if(priority=="high","High",if(priority=="normal","Normal",if(priority=="low","Low","No priority")))'
  projectCount: 'if(!projects || list(projects).length == 0, "No projects", if(list(projects).length == 1, "Single project", "Multiple projects"))'
  contextCount: 'if(!contexts || list(contexts).length == 0, "No contexts", if(list(contexts).length == 1, "Single context", "Multiple contexts"))'
  trackingStatus: 'if(!timeEstimate || timeEstimate == 0 || timeEstimate == null, "No estimate", if(!timeEntries || list(timeEntries).length == 0, "Not started", if(formula.efficiencyRatio < 100, "Under estimate", "Over estimate")))'
  # Combined due/scheduled
  nextDate: 'if((due.isEmpty() == false) && (scheduled.isEmpty() == false), if(date(due) < date(scheduled), due, scheduled), if((due.isEmpty() == false), due, scheduled))'
  daysUntilNext: 'if((due.isEmpty() == false) && (scheduled.isEmpty() == false), min(formula.daysUntilDue, formula.daysUntilScheduled), if((due.isEmpty() == false), formula.daysUntilDue, formula.daysUntilScheduled))'
  hasDate: '(due.isEmpty() == false) || (scheduled.isEmpty() == false)'
  isToday: '((due.isEmpty() == false) && date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")) || ((scheduled.isEmpty() == false) && date(scheduled).format("YYYY-MM-DD") == today().format("YYYY-MM-DD"))'
  isThisWeek: '((due.isEmpty() == false) && date(due).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD") && date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")) || ((scheduled.isEmpty() == false) && date(scheduled).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD") && date(scheduled).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD"))'
  nextDateCategory: '...'  # "Overdue/Past", "Today", "Tomorrow", "This week", "Later", "No date"
  nextDateMonth: '...'  # YYYY-MM format for next date
  nextDateWeek: '...'  # YYYY-[W]WW format for next date

views:
  - type: tasknotesMiniCalendar
    name: "Due"
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - property: due
        direction: ASC
    dateProperty: due
  - type: tasknotesMiniCalendar
    name: "Scheduled"
    order: []
    dateProperty: scheduled
  - type: tasknotesMiniCalendar
    name: "Created"
    dateProperty: file.ctime
  - type: tasknotesMiniCalendar
    name: "Modified"
    dateProperty: file.mtime
```

## Kanban Board

Used by the **Kanban** command to display tasks organized by status.

```yaml
# Kanban Board

filters:
  and:
    - file.hasTag("task")

formulas:
  # ... same formulas as Mini Calendar above ...

views:
  - type: tasknotesKanban
    name: "Kanban Board"
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: tasknotes_manual_order
        direction: DESC
    groupBy:
      property: status
      direction: ASC
    options:
      columnWidth: 280
      hideEmptyColumns: false
```

## Tasks List

Used by the **Tasks** command to display filtered task views.

This template includes multiple views: Manual Order, All Tasks, Not Blocked, Today, Overdue, This Week, and Unscheduled. The Manual Order view groups by status and sorts by the manual-order property so drag-to-reorder works immediately in new bases. The default property name is `tasknotes_manual_order`. The remaining views keep their existing date- and urgency-focused defaults. Each filtered view (except All Tasks) filters for incomplete tasks, handling both recurring and non-recurring tasks. For recurring tasks, the generated filters normalize `complete_instances` values before checking today's date, and missing values are treated as "not completed today" so newly created recurring tasks still appear by default. The "Not Blocked" view additionally filters for tasks that are ready to work on (no incomplete blocking dependencies).
The default views cover common review horizons and can be kept, removed, or cloned with modified filters.

```yaml
# All Tasks

filters:
  and:
    - file.hasTag("task")

formulas:
  # ... same formulas as Mini Calendar above ...

views:
  - type: tasknotesTaskList
    name: "Manual Order"
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: tasknotes_manual_order
        direction: DESC
    groupBy:
      property: status
      direction: ASC
  - type: tasknotesTaskList
    name: "All Tasks"
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: due
        direction: ASC
  - type: tasknotesTaskList
    name: "Not Blocked"
    filters:
      and:
        # Incomplete tasks
        - or:
          # Non-recurring task that's not in any completed status
          - and:
            - recurrence.isEmpty()
            - status != "done"
          # Recurring task where today is not in complete_instances
          - and:
            - recurrence.isEmpty() == false
            - complete_instances.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD")) != true
        # Not blocked by any incomplete tasks
        - or:
          # No blocking dependencies at all
          - blockedBy.isEmpty()
          # All blocking tasks are completed (filter returns only incomplete, then check if empty)
          - 'list(blockedBy).filter(file(if(value.isType("object"), value.uid, value)).properties.status != "done").isEmpty()'
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: formula.urgencyScore
        direction: DESC
  - type: tasknotesTaskList
    name: "Today"
    filters:
      and:
        # Incomplete tasks (handles both recurring and non-recurring)
        - or:
          # Non-recurring task that's not in any completed status
          - and:
            - recurrence.isEmpty()
            - status != "done"
          # Recurring task where today is not in complete_instances
          - and:
            - recurrence.isEmpty() == false
            - complete_instances.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD")) != true
        # Due or scheduled today
        - or:
          - and:
            - due.isEmpty() == false
            - date(due).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")
          - and:
            - scheduled.isEmpty() == false
            - date(scheduled).format("YYYY-MM-DD") == today().format("YYYY-MM-DD")
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: formula.urgencyScore
        direction: DESC
  - type: tasknotesTaskList
    name: "Overdue"
    filters:
      and:
        # Incomplete tasks
        - or:
          # Non-recurring task that's not in any completed status
          - and:
            - recurrence.isEmpty()
            - status != "done"
          # Recurring task where today is not in complete_instances
          - and:
            - recurrence.isEmpty() == false
            - complete_instances.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD")) != true
        # Due or scheduled in the past
        - or:
          - and:
            - due.isEmpty() == false
            - date(due) < today()
          - and:
            - scheduled.isEmpty() == false
            - date(scheduled) < today()
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: formula.urgencyScore
        direction: DESC
  - type: tasknotesTaskList
    name: "This Week"
    filters:
      and:
        # Incomplete tasks
        - or:
          # Non-recurring task that's not in any completed status
          - and:
            - recurrence.isEmpty()
            - status != "done"
          # Recurring task where today is not in complete_instances
          - and:
            - recurrence.isEmpty() == false
            - complete_instances.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD")) != true
        # Due or scheduled this week
        - or:
          - and:
            - due.isEmpty() == false
            - date(due).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD")
            - date(due).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")
          - and:
            - scheduled.isEmpty() == false
            - date(scheduled).format("YYYY-MM-DD") >= today().format("YYYY-MM-DD")
            - date(scheduled).format("YYYY-MM-DD") <= (today() + "7 days").format("YYYY-MM-DD")
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: formula.urgencyScore
        direction: DESC
  - type: tasknotesTaskList
    name: "Unscheduled"
    filters:
      and:
        # Incomplete tasks
        - or:
          # Non-recurring task that's not in any completed status
          - and:
            - recurrence.isEmpty()
            - status != "done"
          # Recurring task where today is not in complete_instances
          - and:
            - recurrence.isEmpty() == false
            - complete_instances.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD")) != true
        # No due date and no scheduled date
        - date(due).isEmpty()
        - date(scheduled).isEmpty()
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: status
        direction: ASC
```

## Calendar

Used by the **Calendar** command to display tasks in a full calendar view with time slots.

```yaml
# Calendar

filters:
  and:
    - file.hasTag("task")

formulas:
  # ... same formulas as Mini Calendar above ...

views:
  - type: tasknotesCalendar
    name: "Calendar"
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    options:
      showScheduled: true
      showDue: true
      showRecurring: true
      showTimeEntries: true
      showTimeblocks: true
      showPropertyBasedEvents: true
      createDailyNotesFromDateLinks: true
      calendarView: "timeGridWeek"
      customDayCount: 3
      firstDay: 0
      slotDuration: "00:30:00"
```

## Agenda

Used by the **Agenda** command to display tasks in a list-based agenda view.

Note: Property-based events are disabled by default to avoid duplicate entries when tasks already have due/scheduled dates.
To build an Agenda variant for completed tasks that do not have due or scheduled dates, enable property-based events and use the completed-date property as the event start date:

```yaml
    options:
      showScheduled: false
      showDue: false
      showRecurring: false
      showTimeEntries: false
      showPropertyBasedEvents: true
      createDailyNotesFromDateLinks: true
    calendarView: "listWeek"
    startDateProperty: completedDate
    listDayCount: 7
    titleProperty: file.basename
```

```yaml
# Agenda

filters:
  and:
    - file.hasTag("task")

formulas:
  # ... same formulas as Mini Calendar above ...

properties:
  formula.dueIn:
    displayName: Due in

views:
  - type: tasknotesCalendar
    name: "Agenda"
    order:
      - status
      - priority
      - due
      - formula.dueIn
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    options:
      showPropertyBasedEvents: false
      createDailyNotesFromDateLinks: true
    calendarView: "listWeek"
    startDateProperty: file.ctime
    listDayCount: 7
    titleProperty: file.basename
```

## Pomodoro Statistics

Generated alongside the default view files to summarize Pomodoro history stored in daily notes.

Note: This Base only reads Pomodoro sessions written to daily note frontmatter. If your history is stored in plugin data, migrate it from **Settings → TaskNotes → Features** before using this view.

```yaml
# Pomodoro statistics
# Generated with your TaskNotes settings
# Requires Pomodoro data storage to be set to Daily notes.

filters:
  and:
    - file.hasProperty("pomodoros")
    - list(note["pomodoros"]).filter(value.startTime).isEmpty() == false

formulas:
  pomodoroDate: 'if(note["pomodoros"], list(note["pomodoros"]).filter(value.startTime).map(date(value.startTime).format("YYYY-MM-DD")).unique().join(", "), file.basename)'
  pomodoroMonth: 'if(note["pomodoros"], list(note["pomodoros"]).filter(value.startTime).map(date(value.startTime).format("YYYY-MM")).unique().join(", "), "")'
  completedPomos: 'if(note["pomodoros"], list(note["pomodoros"]).filter(value.type == "work" && value.completed == true).length, 0)'
  attemptedPomos: 'if(note["pomodoros"], list(note["pomodoros"]).filter(value.type == "work").length, 0)'
  interruptedPomos: 'if(note["pomodoros"], list(note["pomodoros"]).filter(value.type == "work" && value.completed == false).length, 0)'
  focusMinutes: 'if(note["pomodoros"], list(note["pomodoros"]).filter(value.type == "work" && value.completed == true).map(if(value.plannedDuration && value.plannedDuration > 0, value.plannedDuration, if(value.startTime && value.endTime, ((number(date(value.endTime)) - number(date(value.startTime))) / 60000).round(), 0))).reduce(acc + value, 0).round(), 0)'
  focusTime: 'if(formula.focusMinutes >= 60, (formula.focusMinutes / 60).floor() + "h " + (formula.focusMinutes % 60).round() + "m", formula.focusMinutes + "m")'
  completionRate: 'if(formula.attemptedPomos > 0, (formula.completedPomos / formula.attemptedPomos * 100).round() + "%", "0%")'
  shortBreaks: 'if(note["pomodoros"], list(note["pomodoros"]).filter(value.type == "short-break").length, 0)'
  longBreaks: 'if(note["pomodoros"], list(note["pomodoros"]).filter(value.type == "long-break").length, 0)'

properties:
  formula.pomodoroDate:
    displayName: Date
  formula.pomodoroMonth:
    displayName: Month
  formula.completedPomos:
    displayName: Completed
  formula.attemptedPomos:
    displayName: Attempted
  formula.interruptedPomos:
    displayName: Interrupted
  formula.focusMinutes:
    displayName: Focus minutes
  formula.focusTime:
    displayName: Focus time
  formula.completionRate:
    displayName: Completion
  formula.shortBreaks:
    displayName: Short breaks
  formula.longBreaks:
    displayName: Long breaks

views:
  - type: table
    name: "Daily"
    order:
      - formula.pomodoroDate
      - formula.completedPomos
      - formula.focusTime
      - formula.attemptedPomos
      - formula.completionRate
      - formula.interruptedPomos
      - formula.shortBreaks
      - formula.longBreaks
      - file.name
    sort:
      - column: formula.pomodoroDate
        direction: DESC
  - type: table
    name: "Monthly"
    groupBy:
      property: formula.pomodoroMonth
      direction: DESC
    order:
      - formula.pomodoroDate
      - formula.completedPomos
      - formula.focusMinutes
      - formula.focusTime
      - formula.attemptedPomos
      - formula.completionRate
      - formula.interruptedPomos
      - formula.shortBreaks
      - formula.longBreaks
      - file.name
    summaries:
      formula.completedPomos: Sum
      formula.focusMinutes: Sum
      formula.attemptedPomos: Sum
      formula.interruptedPomos: Sum
      formula.shortBreaks: Sum
      formula.longBreaks: Sum
    sort:
      - column: formula.pomodoroDate
        direction: DESC
```

## Relationships

Used by the **Relationships widget** to display task relationships (subtasks, materialized occurrences, projects, blocked by, blocking).

This template uses the special `this` object to reference the current file's properties, enabling dynamic relationship queries.

Note: Unlike other templates, this one does not have a top-level task filter. Each view applies filters as appropriate:

- **Subtasks, Blocked By, Blocking**: Include the task filter and default to manual-order sorting so drag-to-reorder works immediately
- **Occurrences**: Includes the task filter and sorts materialized occurrence notes by occurrence date
- **Projects**: No task filter and no default manual-order sort (project files can be any file type, not just tasks)
When debugging empty relationship tabs, check tab-specific filters first, then verify property values on linked notes.

```yaml
# Relationships
# This view shows all relationships for the current file
# Dynamically shows/hides tabs based on available data

formulas:
  # ... same formulas as Mini Calendar above ...

views:
  - type: tasknotesKanban
    name: "Subtasks"
    filters:
      and:
        - file.hasTag("task")
        - file.hasLink(this.file) && list(note.projects).map(file(value.replace(/^\[[^\]]+\]\((.*)\)$/, "$1").replace(/%20/g, " ")).asLink()).contains(this.file.asLink())
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: tasknotes_manual_order
        direction: DESC
    groupBy:
      property: status
      direction: ASC
  - type: tasknotesTaskList
    name: "Occurrences"
    filters:
      and:
        - file.hasTag("task")
        - file.hasLink(this.file) && note.recurrence_parent && file(note.recurrence_parent.replace(/^\[[^\]]+\]\((.*)\)$/, "$1").replace(/%20/g, " ")).asLink() == this.file.asLink()
    order:
      - status
      - priority
      - due
      - scheduled
      - occurrence_date
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: occurrence_date
        direction: ASC
  - type: tasknotesTaskList
    name: "Projects"
    filters:
      and:
        - list(this.projects).map(file(value.replace(/^\[[^\]]+\]\((.*)\)$/, "$1").replace(/%20/g, " ")).asLink()).contains(file.asLink())
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
  - type: tasknotesTaskList
    name: "Blocked By"
    filters:
      and:
        - file.hasTag("task")
        - list(this.note.blockedBy).map(file(if(value.isType("object"), value.uid, value)).asLink()).contains(file.asLink())
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: tasknotes_manual_order
        direction: DESC
  - type: tasknotesKanban
    name: "Blocking"
    filters:
      and:
        - file.hasTag("task")
        - list(note.blockedBy).map(file(if(value.isType("object"), value.uid, value)).asLink()).contains(this.file.asLink())
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - tags
      - blockedBy
      - file.name
      - recurrence
      - complete_instances
      - file.tasks
    sort:
      - column: tasknotes_manual_order
        direction: DESC
    groupBy:
      property: status
      direction: ASC
```

## Customization

If you've customized your TaskNotes settings (e.g., renamed properties, added custom statuses, or changed task identification methods), the generated templates will reflect those changes:

- **Custom property names**: If you've renamed `due` to `deadline`, the templates will use `deadline`
- **Custom statuses**: The incomplete task filters will check against all your configured completed statuses
- **Custom priorities**: The `priorityWeight` formula will include all your configured priorities with their weights
- **Property-based identification**: If you identify tasks by a property instead of a tag, the filters will use that property
- **Excluded folders**: If you've configured excluded folders, generated TaskNotes task views will add `file.inFolder(...) != true` filters for those folders
- **Custom visible properties**: The `order` arrays will include your configured visible properties
- **Essential card properties**: `file.name`, recurrence, `complete_instances`, and `file.tasks` are always included in generated `order` arrays for TaskNotes card rendering
After major settings changes, regenerate default files and diff against customized versions to merge template updates.

## Related

- [Bases syntax](https://help.obsidian.md/Bases/Bases+syntax) - Complete syntax reference
- [Functions](https://help.obsidian.md/Bases/Functions) - Available functions for filters and formulas
- [Views](https://help.obsidian.md/Bases/Views) - Information about view types and configuration
