# Task List View

The Task List View provides a list-based interface for viewing and managing your tasks. It displays your tasks in a scrollable list, with filtering, sorting, and grouping capabilities.

## FilterBar

The Task List View includes a FilterBar that provides comprehensive filtering capabilities through a hierarchical query builder interface.

### Quick Search

The search input at the top of the FilterBar allows for quick text searches:
- Searches task titles for matching text
- Updates in real-time with 800ms debouncing
- Search terms are added as filter conditions in the query builder

### Query Builder

The FilterBar includes a hierarchical query builder that allows you to create complex filter conditions:

**Filter Groups**: Logical containers that can use AND or OR conjunctions

- Groups can contain individual conditions or nested groups
- Visual nesting shows the hierarchy
- Each group can have its own conjunction (AND/OR)

**Filter Conditions**: Individual filter rules with three parts:

- **Property**: What task attribute to filter on
- **Operator**: How to compare the property
- **Value**: What to compare against

### Available Properties

You can filter on these task properties:

**Text Properties**:

- `title` - Task title/name

**Select Properties**:
- `status` - Task status
- `priority` - Priority level
- `tags` - Task tags
- `contexts` - Task contexts
- `projects` - Task projects (supports wiki-link format)

**Date Properties**:
- `due` - Due date
- `scheduled` - Scheduled date
- `completedDate` - Completion date
- `file.ctime` - File creation date
- `file.mtime` - File modification date

**Boolean Properties**:
- `archived` - Whether task is archived
- `status.isCompleted` - Whether task status indicates completion

**Numeric Properties**:
- `timeEstimate` - Time estimate in minutes

**Special Properties**:
- `recurrence` - Recurrence pattern

### Available Operators

**Text Operators**:
- `contains` / `does-not-contain` - Substring matching (case-insensitive)

**Comparison Operators**:
- `is` / `is-not` - Exact equality/inequality
- `is-greater-than` / `is-less-than` - Numeric comparison

**Date Operators**:
- `is-before` / `is-after` - Date comparison
- `is-on-or-before` / `is-on-or-after` - Inclusive date comparison

**Existence Operators**:
- `is-empty` / `is-not-empty` - Checks for empty/null values
- `is-checked` / `is-not-checked` - Boolean true/false

### Saved Views

The FilterBar supports saving and loading filter configurations:
- **Save**: Name and save current filter, sort, and group settings
- **Load**: Apply a previously saved view configuration
- **Delete**: Remove saved views
- Saved views include the complete filter hierarchy, sorting, and grouping preferences


### Heading display and completion count

The Task List heading shows the active saved view name and the current task count (completed / total).

- No filter selected (shows “All”):

![Saved view heading with count (no filter)](../assets/tasklist_filter_name+count_no_filter.png)

- Saved view selected:

![Saved view heading with count (with filter)](../assets/tasklist_filter_name+count_with_filter.png)

### Sorting Options

Available sort criteria:
- `due` - Due date
- `scheduled` - Scheduled date
- `priority` - Priority level (by weight)
- `title` - Alphabetical
- User fields (from Settings → Advanced → User Fields), shown by their Display Name

When primary sort criteria are equal, tasks are sorted by: scheduled → due → priority → title

### Grouping Options

Available grouping options:
- `none` - No grouping
- `status` - By task status
- `priority` - By priority level
- `context` - By first context
- `project` - By project (tasks can appear in multiple groups)
- `due` - By due date ranges (Today, Tomorrow, This week, etc.)
- `scheduled` - By scheduled date ranges

Note: When Group by equals the Sort user field, group headers follow the selected sort direction.

#### Hierarchical Subgrouping

The Task List View supports two-level hierarchical grouping for enhanced organization:

1. **Enable Primary Grouping**: Choose any grouping option (e.g., "Status")
2. **Add Subgrouping**: Use the sort/group menu (⋯ button) to select a subgroup option
3. **View Structure**: Tasks appear under primary groups, then organized into subgroups

**Example**: Group by "Status" with "Priority" subgroups creates:
- **Open** (primary group)
  - High priority (subgroup)
  - Medium priority (subgroup)
  - Low priority (subgroup)
- **In Progress** (primary group)
  - High priority (subgroup)
  - etc.

Subgroup state (expanded/collapsed) is preserved between sessions, and subgroups are sorted according to the current sort direction.

### Project Group Headers

When grouping tasks by project, the project group headers are interactive:
- **Clickable Navigation**: Project headers that are wikilinks (e.g., `[[Project Name]]`) can be clicked to open the corresponding project note
- **Hover Previews**: Use Ctrl+hover on project headers to preview project notes without opening them
- **Error Handling**: Clicking on project headers for missing files shows appropriate error messages


### Group Controls: Expand/Collapse All

When grouping is enabled, the FilterBar shows top‑bar controls to collapse or expand all groups at once. This helps quickly condense or expand long lists.

- Collapse All: hides the contents of every group
- Expand All: reveals the contents of every group
- The collapsed state is remembered per grouping key for the current view

![Expand/Collapse All demo](../assets/collapse-expand-all-buttons.gif)

## Task Actions

The Task List View provides a variety of ways to interact with your tasks. You can click on a task to open it for editing, or you can use the context menu to perform a variety of actions, such as marking the task as complete, changing its priority, or deleting it.
