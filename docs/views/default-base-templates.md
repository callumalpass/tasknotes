---
title: Default Base Templates
description: Default base file templates for TaskNotes views
dateModified: 2025-12-01T12:00:00+1100
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

## Mini Calendar

Used by the **Mini Calendar** command to display tasks on a calendar grid.

```yaml
# Mini Calendar
# Generated with your TaskNotes settings

filters:
  and:
    - file.hasTag("task")

formulas:
  priorityWeight: 'if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))'

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
  priorityWeight: 'if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))'

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
  priorityWeight: 'if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))'

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
      - column: due
        direction: ASC
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
      - column: due
        direction: ASC
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
      - column: due
        direction: ASC
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
      - column: due
        direction: ASC
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
  priorityWeight: 'if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))'

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
  priorityWeight: 'if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))'

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
  priorityWeight: 'if(priority=="none",0,if(priority=="low",1,if(priority=="normal",2,if(priority=="high",3,999))))'

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
