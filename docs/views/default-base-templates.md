---
title: Default Base Templates
description: Default base file templates for TaskNotes views
dateModified: 2025-12-02T12:00:00+1100
---

# Default Base Templates

TaskNotes automatically generates [Bases](https://help.obsidian.md/Bases/Introduction+to+Bases) files for its built-in views when you first open them. These templates are configured based on your TaskNotes settings, including custom property names, statuses, and task identification methods.

This page shows the default templates as they would appear with TaskNotes' default settings. The actual templates generated in your vault may differ if you've customized your settings.

## Default settings assumptions

The examples below assume:

- **Task identification**: Tag-based using `#task`
- **Field mapping**: Default property names (e.g., `status`, `due`, `scheduled`, `projects`, `contexts`)
- **Statuses**: `none`, `open`, `in-progress`, `done` (only `done` is completed)
- **Priorities**: `none`, `low`, `normal`, `high` (sorted by weight)
- **Visible properties**: `status`, `priority`, `due`, `scheduled`, `projects`, `contexts`, `tags`, `blocked`, `blocking`

## Included formulas

All templates include the following calculated formula properties that you can use in views, filters, and sorting.

### Date calculations

| Formula | Description |
|---------|-------------|
| `daysUntilDue` | Days until due date (negative = overdue, positive = days remaining, null if no due date) |
| `daysUntilScheduled` | Days until scheduled date (negative = past, positive = days remaining, null if no scheduled date) |
| `daysSinceCreated` | Number of days since the task file was created |
| `daysSinceModified` | Number of days since the task file was last modified |

### Boolean formulas

| Formula | Description |
|---------|-------------|
| `isOverdue` | True if task has a past due date and is not completed |
| `isDueToday` | True if task is due today |
| `isDueThisWeek` | True if task is due within the next 7 days |
| `isScheduledToday` | True if task is scheduled for today |
| `isRecurring` | True if task has a recurrence rule |
| `hasTimeEstimate` | True if task has a time estimate > 0 |

### Time tracking

| Formula | Description |
|---------|-------------|
| `timeRemaining` | Time estimate minus time tracked (in minutes), null if no estimate |
| `efficiencyRatio` | Percentage of estimated time used (>100% = took longer, <100% = faster, null if no estimate) |
| `timeTrackedThisWeek` | Total minutes tracked in the last 7 days |
| `timeTrackedToday` | Total minutes tracked today |

### Grouping formulas

These formulas return string values useful for grouping tasks in views:

| Formula | Description | Example values |
|---------|-------------|----------------|
| `dueMonth` | Due date as year-month | "2025-01", "No due date" |
| `dueWeek` | Due date as year-week | "2025-W01", "No due date" |
| `scheduledMonth` | Scheduled date as year-month | "2025-01", "Not scheduled" |
| `scheduledWeek` | Scheduled date as year-week | "2025-W01", "Not scheduled" |
| `dueDateCategory` | Human-readable due date bucket | "Overdue", "Today", "Tomorrow", "This week", "Later", "No due date" |
| `timeEstimateCategory` | Task size by time estimate | "No estimate", "Quick (<30m)", "Medium (30m-2h)", "Long (>2h)" |
| `ageCategory` | Task age bucket | "Today", "This week", "This month", "Older" |
| `createdMonth` | Creation date as year-month | "2025-01" |
| `modifiedMonth` | Last modified date as year-month | "2025-01" |
| `priorityCategory` | Priority as readable label | "High", "Normal", "Low", "No priority" |
| `projectCount` | Number of assigned projects | "No projects", "Single project", "Multiple projects" |
| `contextCount` | Number of assigned contexts | "No contexts", "Single context", "Multiple contexts" |
| `trackingStatus` | Time tracking vs estimate | "No estimate", "Not started", "Under estimate", "Over estimate" |

### Combined due/scheduled formulas

These formulas work with either due date or scheduled date, useful for finding the "next action date":

| Formula | Description | Example values |
|---------|-------------|----------------|
| `nextDate` | The earlier of due or scheduled date | Date value or null |
| `daysUntilNext` | Days until next date (due or scheduled, whichever is sooner) | -2, 0, 5, null |
| `hasDate` | True if task has either a due or scheduled date | true, false |
| `isToday` | True if due OR scheduled today | true, false |
| `isThisWeek` | True if due OR scheduled within 7 days | true, false |
| `nextDateCategory` | Human-readable bucket for next date | "Overdue/Past", "Today", "Tomorrow", "This week", "Later", "No date" |
| `nextDateMonth` | Next date as year-month | "2025-01", "No date" |
| `nextDateWeek` | Next date as year-week | "2025-W01", "No date" |

### Sorting

| Formula | Description |
|---------|-------------|
| `priorityWeight` | Numeric weight for priority sorting (lower = higher priority) |
| `urgencyScore` | Combines priority and next date proximity (due or scheduled, higher = more urgent) |

### Display formulas

| Formula | Description | Example values |
|---------|-------------|----------------|
| `timeTrackedFormatted` | Total time tracked as readable text | "2h 30m", "45m", "0m" |
| `dueDateDisplay` | Due date as relative text | "Today", "Tomorrow", "Yesterday", "3d ago", "Mon", "Dec 15" |

## Mini Calendar

Used by the **Mini Calendar** command to display tasks on a calendar grid.

```yaml
# Mini Calendar
# Generated with your TaskNotes settings

filters:
  and:
    - file.hasTag("task")

formulas:
  # Sorting
  priorityWeight: 'if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))'
  urgencyScore: 'if(!due, formula.priorityWeight, formula.priorityWeight + max(0, 10 - formula.daysUntilDue))'
  # Date calculations
  daysUntilDue: 'if(due, ((number(date(due)) - number(today())) / 86400000).floor(), null)'
  daysUntilScheduled: 'if(scheduled, ((number(date(scheduled)) - number(today())) / 86400000).floor(), null)'
  daysSinceCreated: '((number(now()) - number(file.ctime)) / 86400000).floor()'
  daysSinceModified: '((number(now()) - number(file.mtime)) / 86400000).floor()'
  # Booleans
  isOverdue: 'due && date(due) < today() && status != "done"'
  isDueToday: 'due && date(due).date() == today()'
  isDueThisWeek: 'due && date(due) >= today() && date(due) <= today() + "7d"'
  isScheduledToday: 'scheduled && date(scheduled).date() == today()'
  isRecurring: 'recurrence && !recurrence.isEmpty()'
  hasTimeEstimate: 'timeEstimate && timeEstimate > 0'
  # Time tracking
  timeRemaining: 'if(timeEstimate && timeEstimate > 0, timeEstimate - if(timeEntries, list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0), 0), null)'
  efficiencyRatio: 'if(timeEstimate && timeEstimate > 0 && timeEntries, (list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0) / timeEstimate * 100).round(), null)'
  timeTrackedThisWeek: 'if(timeEntries, list(timeEntries).filter(value.endTime && date(value.startTime) >= today() - "7d").map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)'
  timeTrackedToday: 'if(timeEntries, list(timeEntries).filter(value.endTime && date(value.startTime).date() == today()).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)'
  timeTrackedFormatted: '...'  # Formats total tracked time as "Xh Ym"
  # Grouping
  dueMonth: 'if(due, date(due).format("YYYY-MM"), "No due date")'
  dueWeek: 'if(due, date(due).format("YYYY-[W]WW"), "No due date")'
  scheduledMonth: 'if(scheduled, date(scheduled).format("YYYY-MM"), "Not scheduled")'
  scheduledWeek: 'if(scheduled, date(scheduled).format("YYYY-[W]WW"), "Not scheduled")'
  dueDateCategory: 'if(!due, "No due date", if(date(due) < today(), "Overdue", if(date(due).date() == today(), "Today", if(date(due).date() == today() + "1d", "Tomorrow", if(date(due) <= today() + "7d", "This week", "Later")))))'
  dueDateDisplay: '...'  # Shows "Today", "Tomorrow", "3d ago", "Mon", "Dec 15"
  timeEstimateCategory: 'if(!timeEstimate || timeEstimate == 0, "No estimate", if(timeEstimate < 30, "Quick (<30m)", if(timeEstimate <= 120, "Medium (30m-2h)", "Long (>2h)")))'
  ageCategory: 'if(((number(now()) - number(file.ctime)) / 86400000) < 1, "Today", if(((number(now()) - number(file.ctime)) / 86400000) < 7, "This week", if(((number(now()) - number(file.ctime)) / 86400000) < 30, "This month", "Older")))'
  createdMonth: 'file.ctime.format("YYYY-MM")'
  modifiedMonth: 'file.mtime.format("YYYY-MM")'
  priorityCategory: 'if(priority=="high","High",if(priority=="normal","Normal",if(priority=="low","Low","No priority")))'
  projectCount: 'if(!projects || list(projects).length == 0, "No projects", if(list(projects).length == 1, "Single project", "Multiple projects"))'
  contextCount: 'if(!contexts || list(contexts).length == 0, "No contexts", if(list(contexts).length == 1, "Single context", "Multiple contexts"))'
  trackingStatus: 'if(!timeEstimate || timeEstimate == 0, "No estimate", if(!timeEntries || list(timeEntries).length == 0, "Not started", if(formula.efficiencyRatio < 100, "Under estimate", "Over estimate")))'
  # Combined due/scheduled
  nextDate: 'if(due && scheduled, if(date(due) < date(scheduled), due, scheduled), if(due, due, scheduled))'
  daysUntilNext: 'if(due && scheduled, min(formula.daysUntilDue, formula.daysUntilScheduled), if(due, formula.daysUntilDue, formula.daysUntilScheduled))'
  hasDate: 'due || scheduled'
  isToday: '(due && date(due).date() == today()) || (scheduled && date(scheduled).date() == today())'
  isThisWeek: '(due && date(due) >= today() && date(due) <= today() + "7d") || (scheduled && date(scheduled) >= today() && date(scheduled) <= today() + "7d")'
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
    groupBy:
      property: status
      direction: ASC
    options:
      columnWidth: 280
      hideEmptyColumns: false
```

## Tasks List

Used by the **Tasks** command to display filtered task views.

This template includes multiple views: All Tasks, Not Blocked, Today, Overdue, This Week, and Unscheduled. Each view (except All Tasks) filters for incomplete tasks, handling both recurring and non-recurring tasks. The "Not Blocked" view additionally filters for tasks that are ready to work on (no incomplete blocking dependencies).

```yaml
# All Tasks

filters:
  and:
    - file.hasTag("task")

formulas:
  # ... same formulas as Mini Calendar above ...

views:
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
            - recurrence
            - "!complete_instances.contains(today().format(\"yyyy-MM-dd\"))"
        # Not blocked by any incomplete tasks
        - or:
          # No blocking dependencies at all
          - blockedBy.isEmpty()
          # All blocking tasks are completed (filter returns only incomplete, then check if empty)
          - 'list(blockedBy).filter(file(value.uid).properties.status != "done").isEmpty()'
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
            - recurrence
            - "!complete_instances.contains(today().format(\"yyyy-MM-dd\"))"
        # Due or scheduled today
        - or:
          - date(due) == today()
          - date(scheduled) == today()
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
            - recurrence
            - "!complete_instances.contains(today().format(\"yyyy-MM-dd\"))"
        # Due in the past
        - date(due) < today()
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
            - recurrence
            - "!complete_instances.contains(today().format(\"yyyy-MM-dd\"))"
        # Due or scheduled this week
        - or:
          - and:
            - date(due) >= today()
            - date(due) <= today() + "7 days"
          - and:
            - date(scheduled) >= today()
            - date(scheduled) <= today() + "7 days"
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
            - recurrence
            - "!complete_instances.contains(today().format(\"yyyy-MM-dd\"))"
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
    options:
      showScheduled: true
      showDue: true
      showRecurring: true
      showTimeEntries: true
      showTimeblocks: true
      showPropertyBasedEvents: true
      calendarView: "timeGridWeek"
      customDayCount: 3
      firstDay: 0
      slotMinTime: "06:00:00"
      slotMaxTime: "22:00:00"
      slotDuration: "00:30:00"
```

## Agenda

Used by the **Agenda** command to display tasks in a list-based agenda view.

```yaml
# Agenda

filters:
  and:
    - file.hasTag("task")

formulas:
  # ... same formulas as Mini Calendar above ...

views:
  - type: tasknotesCalendar
    name: "Agenda"
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
    calendarView: "listWeek"
    startDateProperty: file.ctime
    listDayCount: 7
    titleProperty: file.basename
```

## Relationships

Used by the **Relationships widget** to display task relationships (subtasks, projects, blocked by, blocking).

This template uses the special `this` object to reference the current file's properties, enabling dynamic relationship queries.

```yaml
# Relationships
# This view shows all relationships for the current file
# Dynamically shows/hides tabs based on available data

filters:
  and:
    - file.hasTag("task")

formulas:
  # ... same formulas as Mini Calendar above ...

views:
  - type: tasknotesKanban
    name: "Subtasks"
    filters:
      and:
        - note.projects.contains(this.file.asLink())
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
    groupBy:
      property: status
      direction: ASC
  - type: tasknotesTaskList
    name: "Projects"
    filters:
      and:
        - list(this.projects).contains(file.asLink())
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
  - type: tasknotesTaskList
    name: "Blocked By"
    filters:
      and:
        - list(this.note.blockedBy).map(value.uid).contains(file.asLink())
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
  - type: tasknotesKanban
    name: "Blocking"
    filters:
      and:
        - note.blockedBy.map(value.uid).contains(this.file.asLink())
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
- **Custom visible properties**: The `order` arrays will include your configured visible properties

## Related

- [Bases syntax](https://help.obsidian.md/Bases/Bases+syntax) - Complete syntax reference
- [Functions](https://help.obsidian.md/Bases/Functions) - Available functions for filters and formulas
- [Views](https://help.obsidian.md/Bases/Views) - Information about view types and configuration
