# Workflows

This page documents common workflows and use cases for TaskNotes, showing how to combine different features to accomplish specific goals.

## Habit Tracking with Recurring Tasks

TaskNotes supports habit tracking through its recurring task system. Recurring tasks can be created with various patterns and completion status can be tracked using the calendar interface in the task edit modal.

### Creating Recurring Tasks for Habits

#### Natural Language Creation

TaskNotes recognizes recurring patterns in natural language and converts them to RRule format:

- **Daily patterns**: "Exercise daily", "Meditate every day"
- **Weekly patterns**: "Go to gym every Monday", "Weekly team meeting"
- **Interval patterns**: "Water plants every 3 days", "Review goals every other week"
- **Monthly patterns**: "Pay bills monthly", "Clean car every first Saturday"

Examples:

- "Morning meditation daily at 7am" → Creates a daily recurring task scheduled for 7:00 AM
- "Gym every Monday and Wednesday" → Creates a weekly recurring task for specific days
- "Review monthly goals every last Friday" → Creates a monthly recurring task on the last Friday

#### Manual Recurrence Configuration

The recurrence context menu in the task creation or edit modal provides options for:

- **Frequency**: Daily, weekly, monthly, yearly
- **Intervals**: Every N days/weeks/months/years
- **Specific days**: Choose exact weekdays for weekly patterns
- **Ordinal patterns**: First/second/third/last occurrence of a weekday
- **End conditions**: Never end, end after N occurrences, or end by a specific date

### Tracking Completion

The recurring task calendar appears automatically in the task edit modal for any task with a recurrence pattern. This calendar provides:

#### Basic Usage

1. Open any recurring task for editing 
2. The calendar widget appears in the edit modal showing the recurrence pattern
3. Navigate through months using the arrow buttons
4. Click on dates to toggle completion status for specific instances
5. Completed dates are visually distinct from incomplete ones
6. Save changes to store completion data

#### Data Storage

- Completion status is stored in the `complete_instances` field as an array of dates
- Each date represents a specific day when the habit was completed
- The calendar shows all recurring instances based on the recurrence pattern
- Past and future dates can be marked as complete or incomplete

### Example Habit Configurations

#### Daily Habits

```yaml
title: Morning Exercise
recurrence: "FREQ=DAILY"
scheduled: "07:00"
complete_instances: 
  - "2025-01-01"
  - "2025-01-02"
  - "2025-01-04"
```

Daily exercise habit scheduled for 7 AM, with completion tracked for January 1st, 2nd, and 4th.

#### Weekly Habits

```yaml
title: Meal Prep Sunday
recurrence: "FREQ=WEEKLY;BYDAY=SU"
complete_instances:
  - "2025-01-05"
  - "2025-01-12"
```

Weekly meal prep habit every Sunday, with completion tracked for specific Sundays.

#### Custom Interval Habits

```yaml
title: Deep Work Session
recurrence: "FREQ=DAILY;INTERVAL=3"
complete_instances:
  - "2025-01-01"
  - "2025-01-04"
  - "2025-01-07"
```

Habit that recurs every 3 days, suitable for activities that don't require daily repetition.

### Viewing Habit Progress

#### Calendar Views

- **Advanced Calendar View**: Shows all habit instances as events across monthly/weekly/daily views
- **Agenda View**: Lists upcoming habit instances chronologically
- **Filter options**: Use the "Show Recurrent" filter to display only recurring tasks

#### Progress Visualization

The recurring task calendar in the edit modal provides:

- **Pattern recognition**: Visual identification of streaks and gaps in completion
- **Monthly overview**: Complete month's progress at a glance
- **Historical tracking**: Navigation to previous months for past performance review

### Habit Organization Strategies

#### Related Habit Grouping

Multiple related habits can be linked using projects or contexts:

```yaml
title: Morning Routine - Meditation
recurrence: "FREQ=DAILY"
scheduled: "06:30"
contexts: ["@morning"]
projects: ["[[Morning Routine]]"]
```

#### Time-Based Habits

Recurring tasks can be combined with time tracking and Pomodoro features:

```yaml
title: Focused Reading
recurrence: "FREQ=DAILY"
scheduled: "20:00"
time_estimate: 25
```

Daily reading habit with a 25-minute time estimate, suitable for Pomodoro-style focus sessions.

#### Progressive Habits

Habits can be modified over time by editing the recurrence pattern:

1. Start with simple patterns (e.g., `FREQ=DAILY`)
2. Add time estimates and scheduling
3. Adjust frequency or intervals as needed (e.g., `FREQ=DAILY;INTERVAL=2`)

### Implementation Notes

- The calendar interface requires saving the edit modal to persist completion changes
- Recurring instances are generated based on RRule patterns
- Completion tracking is independent of task status (a recurring task can remain "open" while tracking daily completions)
- The recurrence pattern can be modified without losing existing completion data
- Calendar navigation allows review of completion patterns across multiple months

## Project Management

TaskNotes provides integrated project management capabilities through its project assignment and organization features. Projects can be either plain text labels or links to actual Obsidian notes, enabling flexible project organization strategies.

### Project Types and Formats

#### Plain Text Projects

Simple project labels stored as strings:

```yaml
title: "Update website design"
projects: ["Website Redesign", "Client Work"]
```

#### Wikilink Projects

Projects linked to actual Obsidian notes:

```yaml
title: "Research competitors"
projects: ["[[Market Research]]", "[[Q1 Strategy]]"]
```

Wikilink projects provide additional benefits:
- Clickable links that open project notes
- Bidirectional linking between tasks and project notes
- Integration with Obsidian's graph view and backlinks
- Project notes can contain detailed descriptions, goals, and documentation

### Assigning Tasks to Projects

#### During Task Creation

1. Open the task creation modal
2. Click the "Add Project" button in the detailed form section
3. Use the fuzzy search modal to find existing notes or enter new project names
4. Selected projects appear in the projects list with remove options
5. Save the task to persist project assignments

#### Project Selection Interface

The project selection modal provides:

- Fuzzy search across all notes in the vault
- File path display to distinguish between notes with similar names
- Keyboard navigation (arrow keys and Enter)
- Real-time search filtering

#### Multiple Project Assignment

Tasks can be assigned to multiple projects:

- Each project is stored separately in the projects array
- Tasks appear in all relevant project groups when filtering or grouping
- Individual projects can be removed without affecting others
- No limit on the number of projects per task

### Project Organization and Viewing

#### Filtering by Projects

Use the FilterBar to show only tasks from specific projects:

1. Open the advanced filters panel
2. Select one or more projects from the checkbox list
3. Tasks are filtered in real-time to show only selected projects
4. Combine project filters with status, priority, and date filters

#### Grouping Tasks by Project

Organize views by grouping tasks by their project assignments:

- **Task List View**: Group tasks under project headings
- **Kanban View**: Create columns for each project
- **Mixed Project Tasks**: Tasks with multiple projects appear in each relevant group
- **Unassigned Tasks**: Tasks without projects appear in a "No Project" group

#### Search and Discovery

Projects are included in search functionality:

- Search for project names to find related tasks
- Use project-specific searches to focus on particular initiatives
- Combine text search with project filtering for precise results

### Project-Focused Workflows

#### Setting Up a New Project

1. **Create Project Note** (for wikilink projects):
   - Create a new note in Obsidian for the project
   - Add project description, goals, and relevant information
   - Consider using a consistent naming convention

2. **Configure Default Projects**:
   - Set default projects in task creation settings
   - New tasks will automatically include specified projects
   - Useful for focused project work periods

3. **Project Organization**:
   - Use folders to organize project notes hierarchically
   - Create project templates for consistent structure
   - Link related project notes together

#### Daily Project Work

1. **Filter by Current Project**:
   - Use FilterBar to show only current project tasks
   - Focus on specific project work without distractions
   - Switch between projects using saved filter presets

2. **Project Progress Tracking**:
   - Group tasks by project to see progress across initiatives
   - Use status filters to identify blocked or completed work
   - Review overdue tasks within specific projects

3. **Cross-Project Task Management**:
   - Assign tasks to multiple projects when work spans initiatives
   - Use contexts and tags alongside projects for additional organization
   - Track dependencies between projects through linked notes

#### Project Review and Planning

1. **Project Dashboard Creation**:
   - Create project notes with embedded queries showing related tasks
   - Use Obsidian's dataview plugin to create project dashboards
   - Link to task files from project notes for easy navigation

2. **Project-Based Time Tracking**:
   - Filter time tracking reports by project
   - Use project assignment with Pomodoro sessions
   - Analyze time spent across different projects

3. **Project Completion Workflows**:
   - Review all project tasks before marking projects complete
   - Archive or reorganize completed project tasks
   - Update project notes with outcomes and lessons learned

### Project Integration Strategies

#### Combining Projects with Other Features

**Projects + Contexts**:

```yaml
title: "Prepare presentation slides"
projects: ["[[Q4 Planning]]"]
contexts: ["@computer", "@office"]
```
Use contexts to specify where or how project work happens.

**Projects + Tags**:

```yaml
title: "Review budget proposal"
projects: ["[[Budget Planning]]"]
tags: ["#review", "#finance"]
```
Use tags for cross-cutting themes that span multiple projects.

**Projects + Time Management**:

- Schedule project work using due dates and scheduled dates
- Track time spent on projects using time tracking features
- Use Pomodoro sessions focused on specific project work

### Implementation Notes

- Projects are stored as arrays in task frontmatter
- Wikilink projects must reference existing notes or will display as plain text
- Project filtering uses exact name matching (case-sensitive)
- Project selection modal searches note titles and file paths
- Tasks with multiple projects appear in all relevant filtered views
- Project links in task displays open the referenced notes when clicked
