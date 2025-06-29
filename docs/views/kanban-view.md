# Kanban View

The Kanban View displays tasks as cards organized in columns based on their status. This provides a visual workflow management interface similar to tools like Trello or Jira, where tasks progress from left to right through different stages.

## Interface Layout

**Status Columns**: Each column represents a different task status as configured in your settings. The default columns are:
- None/New: Tasks without an assigned status
- Open: Tasks ready to begin
- In Progress: Tasks currently being worked on  
- Done: Completed tasks

**Task Cards**: Individual tasks appear as cards within the appropriate status column. Cards display key task information in a compact format.

**Column Headers**: Show the status name and count of tasks in each column.

## Task Cards

Each task card displays:

**Title**: The main task name, truncated if too long with full title on hover.

**Priority Indicator**: Visual indicator (color or icon) showing task priority level.

**Due Date**: When the task is due, with visual highlighting for overdue items.

**Contexts**: Associated contexts displayed as small tags or badges.

**Tags**: Obsidian tags shown as colored labels.

**Progress Indicators**: 
- Time tracking status if active
- Recurrence indicators for recurring tasks
- Attachment or note content indicators

## Moving Tasks Between Columns

**Drag and Drop**: Click and drag task cards between columns to change their status. The task's status property is automatically updated when dropped in a new column.

**Visual Feedback**: During drag operations:
- The dragged card becomes semi-transparent
- Valid drop zones are highlighted
- Invalid drop areas are visually indicated

**Auto-Save**: Status changes are saved immediately when cards are moved.

## Column Customization

**Status Mapping**: Columns automatically match your configured task statuses from settings. Adding or modifying statuses updates the Kanban columns accordingly.

**Column Order**: Columns appear in the same order as statuses are configured in settings.

**Column Visibility**: Empty columns can be hidden or shown based on preference settings.

**Completed Tasks**: The "Done" column can be configured to:
- Show all completed tasks
- Show only recently completed tasks  
- Hide completed tasks entirely

## Filtering and Search

The Kanban view supports the same filtering options as other views:

**Global Filters**: Applied filters affect all columns simultaneously, showing only tasks that match the criteria.

**Search Integration**: Text search highlights matching cards across all columns.

**Filter Persistence**: Filter settings are maintained when switching between views.

## Task Actions

**Card Click**: Click anywhere on a task card to open the full task note.

**Quick Actions**: Hover over cards to reveal quick action buttons:
- Mark complete/incomplete
- Change priority  
- Edit properties
- Delete task

**Context Menu**: Right-click cards for additional options:
- Open in new tab or pane
- Copy task link
- Convert to different task type
- View task details

**Bulk Selection**: Use Ctrl/Cmd+click to select multiple cards for bulk operations.

## Creating Tasks

**Column Creation**: Click the "+" button at the top of any column to create a new task with that status.

**Quick Add**: Use the quick add input to create tasks that appear in the default status column.

**Drag to Create**: Some workflows support dragging from external sources to create tasks in specific columns.

## Visual Customization

**Color Coding**: Cards are colored based on:
- Priority levels (configurable in settings)
- Due date urgency (overdue, due soon, etc.)
- Custom status colors

**Card Density**: Settings control whether cards show minimal or detailed information.

**Column Width**: Columns automatically size based on content, with minimum and maximum width constraints.

## Performance Considerations

**Virtual Scrolling**: Large numbers of tasks in columns use virtual scrolling to maintain performance.

**Progressive Loading**: Very large task sets load incrementally to keep the interface responsive.

**Efficient Updates**: Only changed cards are re-rendered when task data updates.

## Workflow Benefits

The Kanban view is particularly useful for:

**Project Management**: Visualizing task progression through defined workflow stages.

**Team Coordination**: Understanding what work is in progress versus waiting to be started.

**Bottleneck Identification**: Seeing where tasks accumulate in the workflow.

**Sprint Planning**: Managing development cycles or time-boxed work periods.

**Personal Productivity**: Getting satisfaction from moving tasks toward completion.

## Integration with Other Views

**Cross-View Updates**: Changes made in the Kanban view immediately appear in other TaskNotes views.

**Filter Coordination**: Filters applied in other views can be reflected in the Kanban display.

**Date Integration**: Tasks can be moved in Kanban while maintaining their scheduled or due dates from calendar views.