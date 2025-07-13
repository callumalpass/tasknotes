# Filtering and Views

TaskNotes provides comprehensive filtering capabilities through the FilterBar, available in the Task List, Agenda, Kanban, and Advanced Calendar views. The FilterBar uses a hierarchical query builder to create complex filter conditions and supports saved views for quick access to common filter configurations.

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
**Dropdown Selection**: For status, priority, tags, contexts, and projects
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

Saved views store complete filter configurations for quick access.

### Saving Views
1. Configure your desired filters, sorting, and grouping
2. Click the "Save View" button
3. Enter a name for the view
4. The view is saved and appears in the dropdown

### Loading Views
1. Click the saved views dropdown
2. Select a view name
3. The complete configuration (filters, sorting, grouping) is applied

### Managing Views
- **Load**: Apply a saved view configuration
- **Delete**: Remove a saved view (requires confirmation)
- Views persist across sessions using local storage

## Sorting

Available sort options:
- `due` - Due date (earliest first)
- `scheduled` - Scheduled date (earliest first)
- `priority` - Priority level (by configured weight)
- `title` - Alphabetical (A-Z)

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

This filtering system provides the flexibility to create simple quick filters or complex multi-criteria queries while maintaining good performance and user experience.