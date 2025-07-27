# Test: Hide Completed Tasks from Overdue Setting

## Test Steps
1. Enable the "Hide completed tasks from overdue" setting in Settings > Misc
2. Create a task with a due date in the past (e.g., yesterday)
3. Mark the task as completed
4. Check the agenda view - the completed task should NOT appear as overdue
5. Disable the setting
6. Check the agenda view again - the completed task should now appear as overdue

## Expected Behavior
- When setting is enabled (default): Completed tasks don't show as overdue
- When setting is disabled: Completed tasks show as overdue if their date has passed

## Implementation Details
- Setting: `hideCompletedFromOverdue` (boolean, default: true)
- Function: `isOverdueTimeAware(dateString, isCompleted?, hideCompletedFromOverdue?)`
- Location: Settings > Misc tab
- Impact: Affects agenda view, task grouping, and overdue categorization