# Filtering and Views

TaskNotes provides filtering capabilities through the FilterBar, available in the Task List, Agenda, Kanban, and Advanced Calendar views. The FilterBar uses a hierarchical query builder to create complex filter conditions and supports saved views for quick access to common filter configurations.

## FilterBar Overview

The FilterBar is located at the top of supported views and provides three main sections:

1. **Quick Search**: Immediate text-based filtering
2. **Query Builder**: Hierarchical filter construction
3. **Display Options**: Sorting, grouping, and view-specific settings
4. **Saved Views**: Named filter configurations

## Quick Search

The search input provides instant filtering by task title:
- Type to search task titles in real-time
- Uses case-insensitive substring matching
- Updates with 800ms debouncing for performance
- Search terms appear as filter conditions in the query builder

### Search and Existing Filters

The search functionality intelligently preserves your existing filters:

**When you apply search to existing filters:**
1. All existing filters are automatically grouped together
2. The search condition is added as a separate filter
3. Search and existing filters are connected with "AND" logic

**When you clear search:**
- The search condition is removed
- Original filter structure is restored exactly as it was

**Example:**
If you have filters: `Priority = High OR Status = In Progress`

With search "urgent":
```
Search: title contains "urgent"
AND
Group: (Priority = High OR Status = In Progress)
```

This ensures search never interferes with your carefully crafted filter logic while providing powerful search capabilities on top of existing filters.

## Query Builder

The query builder allows construction of complex filter hierarchies using groups and conditions.

### Filter Groups

Filter groups are logical containers that can hold conditions or other groups:
- **Conjunction**: Choose AND or OR logic for combining contents
- **Nesting**: Groups can contain other groups for complex logic
- **Visual Hierarchy**: Indentation shows the structure

### Filter Conditions

Each condition consists of three parts:

1. **Property**: The task attribute to filter on
2. **Operator**: How to evaluate the property
3. **Value**: What to compare against (when applicable)

### Adding Filters

- **Add Filter**: Creates a new condition with default property and operator
- **Add Filter Group**: Creates a nested group with AND conjunction
- **Delete**: Remove individual conditions or entire groups

### Incomplete Conditions

The filter builder allows incomplete conditions during construction:
- Conditions missing values are ignored during evaluation
- This allows building complex filters step by step
- Only complete conditions affect the displayed tasks

## Available Properties

### Text Properties

- `title` - Task title/name

### Selection Properties

- `path` - Task file path/folder location

- `status` - Task status (uses your configured statuses)
- `priority` - Priority level (uses your configured priorities)
- `tags` - Task tags
- `contexts` - Task contexts
- `projects` - Task projects (supports `[[wiki-link]]` format)

### Date Properties

- `due` - Due date
- `scheduled` - Scheduled date
- `completedDate` - Date when task was completed
- `file.ctime` - File creation date
- `file.mtime` - File modification date

**Natural Language Date Support**: Date properties support both ISO date formats (`2024-12-25`, `2024-12-25T14:30:00`) and natural language patterns for dynamic filtering:

- **Basic dates**: `today`, `tomorrow`, `yesterday`
- **Week patterns**: `next week`, `last week`
- **Relative patterns**: `in 3 days`, `2 days ago`, `in 1 week`, `2 weeks ago`

Natural language dates are resolved dynamically when filters are evaluated, making saved views with dates like "today" stay current over time.

### Boolean Properties

- `archived` - Whether task is archived
- `status.isCompleted` - Whether the task's status indicates completion

### Numeric Properties

- `timeEstimate` - Time estimate in minutes

### User-Defined Properties

TaskNotes supports custom user fields that you define in **Settings → Advanced → User Fields**. These fields appear as filter options based on their configured type:

- **Text fields**: Filter by string content with text operators
- **Number fields**: Filter by numeric values with comparison operators
- **Date fields**: Filter by dates with date operators and natural language support
- **Boolean fields**: Filter by true/false values with checkbox operators
- **List fields**: Filter comma-separated values with intelligent splitting that preserves wikilinks and quoted text


### Special Properties

- `recurrence` - Recurrence pattern (checks if pattern exists)

## Filter Operators

### Text Operators

- `contains` - Text contains substring (case-insensitive)
- `does-not-contain` - Text does not contain substring

### Comparison Operators

- `is` - Exact equality
- `is-not` - Exact inequality
- `is-greater-than` - Numeric greater than
- `is-less-than` - Numeric less than
- `is-greater-than-or-equal` - Numeric greater than or equal (≥)
- `is-less-than-or-equal` - Numeric less than or equal (≤)

### Date Operators

- `is-before` - Date is before specified date
- `is-after` - Date is after specified date
- `is-on-or-before` - Date is on or before specified date
- `is-on-or-after` - Date is on or after specified date

### Existence Operators

- `is-empty` - Property is null, undefined, or empty
- `is-not-empty` - Property has a value
- `is-checked` - Boolean property is true
- `is-not-checked` - Boolean property is false

## Value Inputs

The value input changes based on the selected property and operator:

**Text Input**: For text properties and custom values
**Dropdown Selection**: For status, priority, tags, contexts, projects, and path (folder locations)
**Date Input**: For date properties - supports both ISO dates and natural language
**Number Input**: For numeric properties
**No Input**: For existence operators that don't require values

### Date Input

Date inputs provide real-time validation with visual feedback:
- **Valid input**: Green border indicates recognized date format
- **Invalid input**: Red border indicates unrecognized format
- **Help tooltip**: Click the `?` button to see available natural language patterns
- **Smart filtering**: Only applies filters when input is valid or empty

Examples of valid date inputs:
- ISO formats: `2024-12-25`, `2024-12-25T14:30:00Z`
- Natural language: `today`, `next week`, `in 3 days`, `2 weeks ago`

## Saved Views

Saved views store complete filter configurations and view-specific options for quick access. This includes not only filters, sorting, and grouping, but also view-specific display preferences.

### What Gets Saved

When you save a view, the following state is preserved:

- **Filter Configuration**: All filter conditions, groups, and logic
- **Sorting**: Selected sort criteria and direction
- **Grouping**: Chosen grouping method
- **View Options**: View-specific display preferences such as:
  - **Agenda View**: "Show overdue on today" and "Show notes" toggles
  - **Advanced Calendar**: Display options for scheduled tasks, due dates, timeblocks, recurring tasks, ICS events, and time entries

### Saving Views

1. Configure your desired filters, sorting, and grouping
2. Set any view-specific options (toggles, display preferences)
3. Click the "Save View" button
4. Enter a name for the view
5. The complete view state is saved and appears in the dropdown

### Loading Views

1. Click the saved views dropdown
2. Select a view name
3. The complete configuration is applied, including:
   - Filter conditions and structure
   - Sorting and grouping settings
   - View-specific display options

### Managing Views

- **Load**: Apply a saved view configuration
- **Delete**: Remove a saved view (requires confirmation)
- **Reorder**: Drag and drop saved views to reorder them
- Views persist across sessions using local storage


### Saved Views Button Position

You can choose where the Saved Views button appears in the FilterBar:

- Right (default): Filter → Search → Saved Views
- Left: Saved Views → Filter → Search

This is configured via Settings → Misc → Saved Views button position.

Right position (default):

![Saved Views button on the right](assets/saved_views_button_collapse_all.gif)

Left position:

![Saved Views button on the left](assets/saved_views_button_no_expand_collapse_all.gif)

## Sorting

Available sort options:
- `due` - Due date (earliest first)
- `scheduled` - Scheduled date (earliest first)
- `priority` - Priority level (by configured weight)
- `title` - Alphabetical (A-Z)
- `createdDate` - Date created (newest first)
- User-defined fields (from Settings → Advanced → User Fields). Sorting is type‑aware (number/date/boolean/list). For list fields, empty or missing values sort last.

When Group by matches the selected Sort user field, group header order follows the sort direction (asc/desc).

![Sort by custom user fields](../assets/sort-by-custom-user-fields.gif)

**Fallback Sorting**: When the primary sort criteria are equal, tasks are sorted by: scheduled → due → priority → title

## Grouping

Available grouping options:

- `none` - No grouping (flat list)
- `status` - Group by task status
- `priority` - Group by priority level
- `context` - Group by first context (tasks without contexts appear in "No Context")
- `project` - Group by project (tasks can appear in multiple groups)
- `due` - Group by due date ranges (Today, Tomorrow, This Week, etc.)
- `scheduled` - Group by scheduled date ranges

**Project Grouping**: Tasks with multiple projects appear in each project group.

## Performance Considerations

## Task Card Layout (Display Fields)

You can customize the content shown on task cards using the Layout section in the Filter modal. This feature lets you add up to three additional rows (rows 2–4; row 1 is always the title) using a compact text syntax.

![Task card layout demo](../assets/display-custom-fileds-task-card-demo.gif)

### Where to find it
- Open any supported view (Task List, Agenda, Kanban)
- Click the Filter button to open the Filter modal
- Scroll to the "Layout" section
- Expand "Layout syntax help" for reference and examples

### Basics
- Each row accepts a text string composed of tokens and optional literal text
- A token renders a task property and uses the format: `{property|flags}`
- Multiple tokens can be placed on a row, separated by spaces
- Anything outside `{}` is treated as literal text and rendered as-is

### Implemented flags
- `n` – Show the field name (label) before the value; optionally override the label with `n(Name)`

Escaping inside labels: use `\|` for `|` and `\)` for `)`

### Supported properties
- Built-ins: `due`, `scheduled`, `priority`, `status`, `contexts`, `projects`, `timeEstimate`, `tags`, `completedDate`, `title` (title is already row 1 and typically not needed here)
- Custom frontmatter keys: use the exact frontmatter key, e.g., `assignee`, `effort`, `custom_key`
  - If you previously used `user:<id>` in a layout, you can now simply use the field key without the `user:` prefix (e.g., `{effort}`)

### Examples
- Row with labels and custom label:
  - `{due|n(Due)} {priority|n}`
- Contexts with a custom label containing a pipe:
  - `{contexts|n(Contexts\|Areas)}`
- Mixing tokens and literal separators:
  - `Due {due} · Est {timeEstimate}`

Notes
- Title is fixed on row 1; you configure only rows 2–4
- Only implemented flags are documented here (n). Future flags may be introduced later


The FilterBar includes several performance optimizations:

- **Debounced Input**: Search (800ms) and filter changes (300ms) are debounced
- **Batch Loading**: Tasks are loaded in batches of 50
- **Smart Updates**: Only affected UI components re-render when filters change
- **Efficient Evaluation**: Empty groups and incomplete conditions are handled efficiently

## Filter Evaluation Logic

Understanding how filters are evaluated:

1. **Empty Groups**: Groups with no conditions return true (no filtering)
2. **Incomplete Conditions**: Conditions missing required values are ignored
3. **Array Properties**: For properties with multiple values (tags, contexts), any matching value satisfies the condition
4. **Wiki Links**: Project values in `[[link]]` format are automatically resolved
5. **Case Sensitivity**: Text matching is case-insensitive
6. **Date Precision**: Date comparisons account for time components

## Example Filter Scenarios

### Simple Text Search

- Property: `title`
- Operator: `contains`
- Value: `meeting`

### Dynamic Date Filters

Using natural language dates for filters that stay current:
- Property: `due`
- Operator: `is-on-or-after`
- Value: `today`

### Complex Date Range

Group with AND conjunction:
- Condition 1: `due` `is-on-or-after` `2024-01-01`
- Condition 2: `due` `is-on-or-before` `2024-01-31`

### This Week's Tasks

Using natural language for relative time periods:
- Property: `due`
- Operator: `is-on-or-after`
- Value: `next week`

### High Priority Incomplete Tasks

Group with AND conjunction:
- Condition 1: `priority` `is` `high`
- Condition 2: `status.isCompleted` `is-not-checked`

### Multiple Projects or Contexts

Group with OR conjunction:

- Condition 1: `projects` `contains` `[[Work Project]]`
- Condition 2: `contexts` `is` `work`

### Folder-Based Filtering

Filter tasks by their location in your vault:

**Tasks in a specific folder:**
- Property: `path`
- Operator: `contains`
- Value: `Work/Projects` (shows tasks in the Work/Projects folder)

**Tasks in vault root:**
- Property: `path`
- Operator: `contains`
- Value: `(Root)` (shows tasks in the vault root directory)

**Exclude tasks from specific folders:**
- Property: `path`
- Operator: `does-not-contain`
- Value: `Archive` (hides tasks in Archive folders)

**Tasks without folder structure:**
- Property: `path`
- Operator: `is-empty` (shows tasks with no folder path)

The path dropdown automatically populates with all unique folder paths found in your vault, making it easy to select existing locations.

### Custom User Field Examples

**Filtering by Effort Level (Number field):**
- Property: `Effort Level` (user field)
- Operator: `is greater than or equal`
- Value: `3`

This filters tasks where effort is 3 or higher, useful for finding substantial work items.

**Filtering by Team Members (List field):**
- Property: `Assigned To` (user field)
- Operator: `contains`
- Value: `John Smith`

This finds tasks assigned to John Smith, even when multiple people are assigned.

**Mixed Priority Filtering (Number field with text):**
- Property: `Priority Level` (user field)
- Operator: `is greater than`
- Value: `1`

With values like "1-Low", "2-Medium", "3-High", if the custom property is defined as "Number" in the plugin settings, this shows Medium and High priority tasks by evaluating the numeric prefix.

This filtering system provides the flexibility to create simple quick filters or complex multi-criteria queries while maintaining good performance and user experience.
