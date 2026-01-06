# Task Management

[← Back to Features](../features.md)

This page covers task creation, properties, projects, dependencies, recurring tasks, and reminders. For the underlying architecture, see [Core Concepts](../core-concepts.md).

## Creating and Editing Tasks

You can create and edit tasks in a variety of ways. The primary method is through the **Task Creation Modal**, which can be accessed via the "Create new task" command or by clicking on dates or time slots in the calendar views. This modal provides an interface for setting all available task properties, including title, status, priority, and due dates.

![Task Creation Modal](../assets/modal-task-create.png)

When creating a task, the title will be automatically sanitized to remove any characters that are forbidden in filenames.

TaskNotes also supports **Natural Language Creation**, which allows you to create tasks by typing descriptions in plain English. The built-in parser can extract structured data from phrases like "Buy groceries tomorrow at 3pm @home #errands high priority."

### Auto-Suggestions in Natural Language Input

The natural language input field includes auto-suggestion functionality that activates when typing specific trigger characters:

- **@** - Shows available contexts from existing tasks
- **#** - Shows available tags from existing tasks
- **+** - Shows files from your vault as project suggestions
- **\*** - Shows available status options (configurable trigger in Settings → Features)

#### Project Suggestions

When typing `+` in the natural language input, you'll see up to 20 suggestions from your vault's markdown files. The suggestions display additional information to help identify files:

```
project-alpha [title: Alpha Project Development | aliases: alpha, proj-alpha]
meeting-notes [title: Weekly Team Meeting Notes]
simple-project
work-file [aliases: work, office-tasks]
```

Project suggestions search across:
- File names (basename without extension)
- Frontmatter titles (using your configured field mapping)
- Frontmatter aliases
- Optional filtering by required tags, folders, and a specific frontmatter property/value defined in Settings → Appearance & UI → Project Autosuggest

Selecting a project suggestion inserts it as `+[[filename]]`, creating a wikilink to the file while maintaining the `+` project marker that the natural language parser recognizes.


#### Enhanced Project Auto‑suggester (configurable cards)

Project suggestions can display configurable multi‑row cards and support smarter search. Configure up to 3 rows using a simple token syntax in Settings → Appearance & UI → Project Autosuggest.

- Properties: file.basename, file.name, file.path, file.parent, title, aliases, and any frontmatter key
- Flags:
  - n or n(Label) → show the field name/label before the value
  - s → include this field in + search (in addition to defaults)
- Literals: you can mix in fixed text or emojis between tokens

Examples

- "{title|n(Title)}" → Title: Alpha Project
- "🔖 {aliases|n(Aliases)}" → 🔖 Aliases: alpha, proj-alpha
- "{file.path|n(Path)|s}" → include path in + search as well as display it

Search behavior

- Defaults: + search always includes file basename, title (via your field mapping), and aliases
- |s flag: add more searchable fields on top of the defaults (e.g., file.path or a custom frontmatter key like customer)
- Fuzzy: optional fuzzy matching can be enabled in settings for broader, multi‑word matches

Performance tips

- Keep rows to three or fewer for clarity and performance (the UI supports up to 3)
- Prefer specific searchable fields with |s on large vaults

Demo

![Autosuggest projects with spaces](../assets/autosuggest_project_names_with_space.gif)

![Enhanced project autosuggester](../assets/enhanced-project-auto-suggester.gif)


#### Status Suggestions

When typing the status trigger character (default `*`) in the natural language input, you'll see suggestions for all configured status options:

![Status Auto-Suggestion](../assets/auto-suggest-status.gif)

Status suggestions allow quick selection of statuses when creating tasks. For example, typing `*in` shows "In Progress" as a suggestion if that's one of your configured statuses.

Additionally, you can convert any line type in your notes to TaskNotes using the **Instant Conversion** feature. This works with checkboxes, bullet points, numbered lists, blockquotes, headers, and plain text lines.

## Task Properties

Tasks store their data in YAML frontmatter with properties for status, priority, dates, contexts, projects, tags, time estimates, recurrence, and reminders. Custom fields can extend this structure.

For property types and examples, see [Core Concepts](../core-concepts.md#yaml-frontmatter). For configuration options, see [Task Properties Settings](../settings/task-properties.md).

## Projects

TaskNotes supports organizing tasks into projects using note-based linking. Projects are represented as links to actual notes in your vault, allowing you to leverage Obsidian's linking and backlinking features for project management.

### Project Assignment

Tasks can be assigned to one or more projects through the task creation or editing interface. When creating or editing a task, click the "Add Project" button to open the project selection modal. This modal provides fuzzy search functionality to quickly find and select project notes from your vault.

### Project Links

Projects are stored as wikilinks in the task's frontmatter (e.g., `projects: ["[[Project A]]", "[[Project B]]"]`). These links are clickable in the task interface and will navigate directly to the project notes when clicked. Any note in your vault can serve as a project note simply by being linked from a task's projects field.

### Organization and Filtering

Tasks can be filtered and grouped by their associated projects in all Bases-driven task views. Use the Bases filter editor to add `note.projects` conditions, and configure the grouping menu to organize Task List or Kanban boards by project. Tasks assigned to multiple projects will appear in each relevant project group, providing flexibility in project-based organization.

### Project Indicators

TaskCards display visual indicators when tasks are used as projects. These indicators help identify which tasks have other tasks linked to them as subtasks, making project hierarchy visible at a glance.

### Subtask Creation

Tasks can have subtasks created directly from their context menu. When viewing a task that serves as a project, you can select "Create subtask" to create a new task automatically linked to the current project.

## Dependencies

Task dependencies capture prerequisite work using RFC&nbsp;9253 terminology. Dependencies are stored in frontmatter as structured objects:

```yaml
blockedBy:
  - uid: "[[Operations/Order hardware]]"
    reltype: FINISHTOSTART
    gap: P1D
```

- `uid` references the blocking task, typically through an Obsidian wikilink.
- `reltype` supports `FINISHTOSTART`, `FINISHTOFINISH`, `STARTTOSTART`, and `STARTTOFINISH`. Newly created links default to `FINISHTOSTART`.
- `gap` is optional and uses ISO&nbsp;8601 duration syntax (for example `PT4H` or `P2D`).

Whenever a dependency is added, TaskNotes updates the upstream note’s `blocking` list so the reverse relationship stays synchronized. Removing a dependency automatically clears both sides.

### Selecting dependencies in the UI

- The task creation and edit modals expose “Blocked by” and “Blocking” buttons that launch a fuzzy task selector. The picker only offers valid tasks, excludes the current note, and prevents duplicate entries.
- The task context menu provides the same selector, enabling dependency management directly from the Task List, Kanban, and calendar views.
- Task cards show a fork icon whenever a task blocks other work. Clicking it expands an inline list of downstream tasks without triggering the parent card’s modal, so you can inspect dependents in place.

These controls adopt sensible defaults while allowing you to adjust relationship type or gap when the schedule requires more precision.

## Automation

### Auto-Archiving

TaskNotes can automatically archive tasks when they transition into a status that has auto-archiving enabled. This keeps completed work out of your active lists without requiring manual cleanup.

Configure auto-archiving per status from **Settings → Task Properties → Task Statuses**. Each status card includes an **Auto-archive** toggle and a **Delay (minutes)** input (1–1440). When you turn the toggle on for a status, any task moved into that status is queued for archiving once the delay elapses. Moving the task to a different status before the timer expires cancels the pending archive automatically.

The auto-archive queue runs in the background and persists across plugin restarts. If TaskNotes was closed while an archive was pending, the task will be archived shortly after the plugin loads again as long as it still matches the configured status.

## File Management and Templates

TaskNotes provides a system for managing your task files. You can specify a **Default Tasks Folder** where all new tasks will be created, and you can choose from a variety of **Filename Generation** patterns, including title-based, timestamp-based, and Zettelkasten-style.

TaskNotes also supports **Templates** for both the YAML frontmatter and the body of your task notes. You can use templates to pre-fill common values, add boilerplate text, and create a consistent structure for your tasks. Templates can also include variables, such as `{{title}}`, `{{date}}`, `{{contexts}}`, `{{projects}}`, and `{{parentNote}}` (which inserts the parent note as a properly formatted markdown link), which will be automatically replaced with the appropriate values when a new task is created. When you want project notes to receive an automatic link during task creation or instant conversion, place `{{parentNote}}` inside a YAML list (for example, `projects:
  - {{parentNote}}`) so the generated frontmatter matches TaskNotes' project linking format.

## Recurring Tasks

TaskNotes provides recurring task management using the RFC 5545 RRule standard with DTSTART support and dynamic scheduled dates. The system separates recurring pattern behavior from individual occurrence scheduling.

### Core Concepts

Recurring tasks in TaskNotes operate on two independent levels:

1. **Recurring Pattern**: Defines when pattern instances appear (controlled by DTSTART in the recurrence rule)
2. **Next Occurrence**: The specific date/time when you plan to work on the next instance (controlled by the scheduled field)

This separation allows for flexible scheduling where you can reschedule individual occurrences without affecting the overall pattern.

### Setting Up Recurring Tasks

#### Creating Recurrence Patterns

You can create recurring tasks through:

1. **Recurrence Context Menu**: Right-click the recurrence field in any task modal to access preset patterns or custom recurrence options
2. **Preset Options**: Selections like "Daily," "Weekly on [current day]," "Monthly on the [current date]"
3. **Custom Recurrence Modal**: Editor with date picker, time picker, and RRule configuration

#### Required Components

Recurring tasks require:
- **Recurrence Rule**: An RRule string with DTSTART defining the pattern
- **Scheduled Date**: The next occurrence date (can be independent from the pattern)

#### DTSTART Integration

All recurrence rules now include DTSTART (start date and optionally time):
- **Date-only**: `DTSTART:20250804;FREQ=DAILY` (pattern instances appear all-day)
- **Date and time**: `DTSTART:20250804T090000Z;FREQ=DAILY` (pattern instances appear at 9:00 AM)

### Recurring Task Due Date

When a recurring task is completed, the scheduled date is advanced to the next occurrence. By default, the due date is not changed. However, you can enable the `Maintain due date offset in recurring tasks` setting to automatically update the due date as well.

When this setting is enabled, the offset between the original scheduled date and due date is calculated. This offset is then applied to the new scheduled date to determine the new due date.

For example, consider a task with the following properties:

- **Scheduled Date**: 2025-01-01
- **Due Date**: 2025-01-03
- **Recurrence**: Every week

In this case, the due date is 2 days after the scheduled date. When this task is completed, the new scheduled date will be 2025-01-08. If the `Maintain due date offset in recurring tasks` setting is enabled, the new due date will be set to 2025-01-10, preserving the 2-day offset.

To enable this feature, go to the TaskNotes settings and select the "Features" tab. From there, you can enable the `Maintain due date offset in recurring tasks` option.

### Recurrence Pattern Examples

TaskNotes supports the RFC 5545 RRule standard with DTSTART:

```
DTSTART:20250804T090000Z;FREQ=DAILY
→ Daily at 9:00 AM, starting August 4, 2025

DTSTART:20250804T140000Z;FREQ=WEEKLY;BYDAY=MO,WE,FR
→ Monday, Wednesday, Friday at 2:00 PM, starting August 4, 2025

DTSTART:20250815;FREQ=MONTHLY;BYMONTHDAY=15
→ 15th of each month (all-day), starting August 15, 2025

DTSTART:20250801T100000Z;FREQ=MONTHLY;BYDAY=-1FR
→ Last Friday of each month at 10:00 AM, starting August 1, 2025
```

### Dynamic Scheduled Dates

The `scheduled` field automatically updates to show the next uncompleted occurrence:

1. **When creating**: Initially set to the DTSTART date
2. **When completing**: Automatically advances to the next uncompleted occurrence
3. **When rule changes**: Recalculates based on the new pattern
4. **Manual reschedule**: Can be set to any date independently

#### Example Behavior

```yaml
# Initial state

recurrence: "DTSTART:20250804T090000Z;FREQ=DAILY"
scheduled: "2025-08-04T09:00"
complete_instances: []

# After completing Aug 4th

recurrence: "DTSTART:20250804T090000Z;FREQ=DAILY"  # unchanged
scheduled: "2025-08-05T09:00"  # auto-updated to next day
complete_instances: ["2025-08-04"]

# After manually rescheduling next occurrence

recurrence: "DTSTART:20250804T090000Z;FREQ=DAILY"  # unchanged
scheduled: "2025-08-05T14:30"  # manually set to 2:30 PM
complete_instances: ["2025-08-04"]

# Calendar view shows:

# - Aug 5 at 2:30 PM: Next occurrence (solid border)
# - Aug 6+ at 9:00 AM: Pattern instances (dashed border)
```

### Drag and Drop Behavior

In calendar views, recurring tasks display two types of events:

- **Next occurrence** (solid border): Dragging updates only the `scheduled` field for that specific instance
- **Pattern instances** (dashed border): Dragging updates DTSTART, changing all future pattern instances

### Completion Tracking

#### Individual Instance Completion
Each occurrence can be completed independently through:
- Task cards (completes for current date)
- Calendar context menu (completes for specific date)
- Task edit modal completion calendar

Completed instances are stored in the `complete_instances` array:
```yaml
complete_instances: ["2025-08-04", "2025-08-06", "2025-08-08"]
```

#### Automatic Scheduled Date Updates

When completing occurrences:
- The `scheduled` field automatically updates to the next uncompleted occurrence
- Uses UTC anchor principle for consistent timezone handling
- Skips already completed dates when calculating the next occurrence

### Flexible Scheduling

#### Next Occurrence Independence

The next scheduled occurrence can be set to any date, including:
- **Before DTSTART**: Schedule the next occurrence before the pattern officially begins
- **Outside pattern**: Schedule Tuesday's occurrence for a weekly Monday pattern
- **Different time**: Next occurrence at 2 PM while pattern instances remain at 9 AM
- **Far future**: Schedule weeks ahead while pattern continues normally

#### Examples of Flexible Scheduling

**Example 1: Early Start**
```yaml
recurrence: "DTSTART:20250810T090000Z;FREQ=WEEKLY;BYDAY=MO"  # Mondays at 9 AM
scheduled: "2025-08-07T14:00"  # Next occurrence on preceding Thursday
```
Shows next occurrence Thursday 2 PM, pattern instances on Mondays 9 AM.

**Example 2: Off-Pattern Day**
```yaml
recurrence: "DTSTART:20250804T090000Z;FREQ=WEEKLY;BYDAY=MO"  # Mondays at 9 AM
scheduled: "2025-08-06T15:30"  # Next occurrence on Wednesday
```
Shows next occurrence Wednesday 3:30 PM, pattern instances on Mondays 9 AM.

### Completion Calendar

The task edit modal includes a completion calendar for recurring tasks:
- Click any date to toggle completion status for that specific occurrence
- Changing completions automatically updates the scheduled date to the next uncompleted occurrence
- Visual indicators show which dates are part of the recurring pattern vs completed

### Timezone Handling

All recurring task logic uses the UTC Anchor principle:
- Pattern generation uses UTC dates for consistency
- DTSTART dates are interpreted as UTC anchors
- Display adapts to user's local timezone
- Prevents off-by-one date errors across timezone boundaries

### Backward Compatibility

TaskNotes maintains full backward compatibility:
- **Legacy RRule strings** without DTSTART continue to work using scheduled date as anchor
- **Legacy recurrence objects** are automatically converted to RRule format
- **Existing tasks** gain new functionality without requiring migration
- **Mixed formats** are handled transparently

### Advanced Configuration

#### Custom Recurrence Modal

The custom recurrence modal provides:
- **Start date picker**: Set the DTSTART date
- **Start time picker**: Set the DTSTART time (optional)
- **Frequency options**: Daily, weekly, monthly, yearly
- **RRule patterns**: RRule configurations
- **End conditions**: Until date, count limits, or never-ending

#### Time Independence

Pattern time (DTSTART) and next occurrence time (scheduled) are independent:
- Pattern instances can appear at 9 AM while next occurrence is at 2 PM
- Dragging pattern instances changes the pattern time for all future instances
- Dragging next occurrence only affects that specific instance
- Both timing aspects can be controlled separately

## Task Reminders

TaskNotes provides a reminder system that allows you to set notifications for your tasks. The reminder system uses the iCalendar VALARM specification and supports both relative reminders (based on due or scheduled dates) and absolute reminders (specific date and time).

### Reminder Types

#### Relative Reminders

Relative reminders are triggered relative to a task's due date or scheduled date. These are useful for consistent notification patterns across different tasks.

**Examples:**
- 15 minutes before due date
- 1 hour before scheduled date
- 2 days before due date
- 30 minutes after scheduled date

#### Absolute Reminders

Absolute reminders are triggered at a specific date and time, regardless of the task's due or scheduled dates. These are useful for time-sensitive notifications or follow-up actions.

**Examples:**

- October 26, 2025 at 9:00 AM
- Tomorrow at 2:30 PM
- Next Monday at 10:00 AM

### Setting Up Reminders

#### Adding Reminders to Tasks

You can add reminders to tasks through several methods:

1. **Task Creation Modal**: When creating a new task, use the reminder field to access the reminder interface
2. **Task Edit Modal**: Edit existing tasks and manage their reminders
3. **Task Cards**: Click the bell icon on any task card to access quick reminder options
4. **Context Menu**: Right-click the reminder field for quick access to common options

#### Quick Reminder Options

The reminder context menu provides quick access to common reminder patterns:

**Before Due Date:**
- 5 minutes before
- 15 minutes before
- 1 hour before
- 1 day before

**Before Scheduled Date:**
- 5 minutes before
- 15 minutes before
- 1 hour before
- 1 day before

These quick options are only available when the task has the corresponding due or scheduled date set.

#### Reminder Modal

For advanced reminder management, use the Reminder Modal which provides:

- **Form-based reminder creation** with validation and real-time preview
- **Multiple reminder management** for complex notification needs
- **Custom descriptions** for personalized reminder messages
- **Visual indicators** showing task context (due date, scheduled date)
- **Editing and deletion** of existing reminders

### Reminder Data Format

Reminders are stored in the task's YAML frontmatter as an array using the following format:

#### Relative Reminder Structure

```yaml
reminders:
  - id: "rem_1678886400000_abc123xyz"
    type: "relative"
    relatedTo: "due"
    offset: "-PT15M"
    description: "Review task details"
```

#### Absolute Reminder Structure

```yaml
reminders:
  - id: "rem_1678886400001_def456uvw"
    type: "absolute"
    absoluteTime: "2025-10-26T09:00:00"
    description: "Follow up with client"
```

#### Field Descriptions

- **id**: Unique identifier for UI management and updates
- **type**: Either "relative" or "absolute"
- **relatedTo** (relative only): Anchor date - either "due" or "scheduled"
- **offset** (relative only): ISO 8601 duration format (negative for before, positive for after)
- **absoluteTime** (absolute only): Full ISO 8601 timestamp
- **description** (optional): Custom notification message

### Visual Indicators

#### Task Card Bell Icons

Tasks with reminders display a bell icon on their task cards:
- **Solid bell**: Task has active reminders
- **Clickable**: Opens the reminder context menu for quick management
- **Positioned**: Properly spaced with other task indicators (priority, status, etc.)

#### Reminder Context Information

When managing reminders, the interface displays relevant task context:
- Current due date (if set)
- Current scheduled date (if set)
- Existing reminders count
- Task title for reference

### Default Reminders

TaskNotes supports configuring default reminders that automatically apply to new tasks. This feature eliminates the need to manually add common reminders to every task.

#### Configuring Default Reminders

Configure default reminders from TaskNotes settings:

1. Navigate to Settings → TaskNotes → Task Properties
2. Expand the **Reminders** property card
3. Locate the **Default Reminders** section
4. Use the form to add new default reminders

#### Default Reminder Application

Default reminders automatically apply to:

- **Manual task creation** through the task creation modal
- **Instant conversion** of existing content to tasks
- **Natural language task creation** using the parser

#### Default Reminder Examples

Common default reminder configurations:

- 15 minutes before due date (for all tasks with due dates)
- 1 hour before scheduled date (for time-sensitive tasks)
- 1 day before due date (for project deadlines)
- Custom absolute reminders for recurring processes

### Technical Details

Reminders use the iCalendar VALARM specification with ISO 8601 duration formats. The reminder property name can be customized through field mapping in settings.
