# feat-subtask-status-strip

## Subtask status indicator when grouped by status

When a view groups by status, the status property is hidden but subtasks still need a status cue (they can differ from their parent). This update keeps that signal but reduces its visual weight: in that case, subtasks render a thin status-colored stripe on the right edge instead of the full dot. If status is simply hidden via properties (without grouping), no status indicator is shown at all. Main tasks keep their existing behavior.

## Changelog

### Task Cards & Note Widgets

- Mark task cards as status-hidden only when status is grouped (hideStatusIndicator).
- Subtasks inherit that state and replace the status dot with a subtle right-edge stripe.
- Add styling for the subtask status stripe.
