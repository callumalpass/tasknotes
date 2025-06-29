# Task List View

The Task List View provides a list-based interface for viewing and managing your tasks. It displays tasks as cards in a scrollable list with filtering and organization options.

## Interface Layout

The Task View consists of three main areas:

**Filter Bar**: Located at the top, contains search input, filter dropdowns, and view controls. This bar can be collapsed to save space.

**Task List**: The main content area showing tasks as cards. Each card displays task information in a structured format.

**Status Bar**: Shows the total number of tasks and how many match current filters.

## Task Display

Each task row shows:

- **Title**: The task name, which links to the task note when clicked
- **Status**: Current task status (configurable icons and colors)
- **Priority**: Priority level (configurable icons and colors)  
- **Due Date**: When the task is due (if set)
- **Scheduled Date**: When the task is scheduled for work (if set)
- **Contexts**: Associated contexts (displayed as tags)
- **Tags**: Obsidian tags associated with the task
- **Time Estimate**: Estimated time to complete (if set)

## Filtering Options

The filter bar provides several ways to narrow down the displayed tasks:

**Text Search**: Search across task titles and note content. Search is case-insensitive and supports partial matches.

**Status Filter**: Show only tasks with specific statuses. Multiple statuses can be selected simultaneously.

**Priority Filter**: Filter by priority levels. Supports selecting multiple priorities.

**Context Filter**: Show tasks associated with specific contexts. Context suggestions appear as you type.

**Tag Filter**: Filter by Obsidian tags. Tag suggestions appear based on tags in your vault.

**Date Filters**: 
- Show tasks due within specific time ranges (today, this week, this month, overdue)
- Show tasks scheduled for specific periods
- Custom date range selection

**Completion Filter**: Toggle between showing completed tasks, incomplete tasks, or both.

## Sorting and Grouping

**Sorting**: Click column headers to sort by that field. Click again to reverse the sort order. Available sort fields include:
- Title (alphabetical)
- Status (by configured status order)
- Priority (by configured priority weight)
- Due date (chronological)
- Scheduled date (chronological)
- Creation date (chronological)
- Modification date (chronological)

**Grouping**: Group tasks by common properties to organize related items:
- Group by status to see task progression
- Group by priority to focus on important items
- Group by context to see location or tool-specific tasks
- Group by due date to organize by deadlines
- Group by tags for project or category organization

## Task Actions

**Direct Editing**: 
- Click task titles to open the full task note
- Click status or priority indicators to cycle through options
- Some fields support inline editing when clicked

**Context Menus**: Right-click any task for additional actions:
- Open in new tab or split pane
- Mark as complete/incomplete
- Edit task properties
- Delete task
- Copy task link

**Quick Actions**: Tasks can be managed individually through context menus and direct interaction with task elements.

## View Customization

**Display Options**: Adjust how tasks are presented in the list format.

**Card Density**: Tasks can be displayed with varying amounts of detail based on available space.

**Color Coding**: Tasks are colored based on:
- Priority levels (configurable colors)
- Due dates (overdue tasks highlighted)
- Status types (completed, in-progress, etc.)

## Performance Considerations

The Task View is optimized for large numbers of tasks:

- **Virtual Scrolling**: Only visible rows are rendered, maintaining performance with thousands of tasks
- **Efficient Filtering**: Filters use indexed data for fast response
- **Incremental Updates**: Only changed tasks are re-rendered when data updates

## Integration Features

**Task Creation**: Create new tasks directly from the view using the "Add Task" button. New tasks inherit current filter settings where applicable.

**Note Integration**: Tasks created from other notes (using inline conversion) appear in the Task View immediately.

**External Updates**: Changes made to task files outside TaskNotes are reflected in the view automatically through Obsidian's metadata cache.