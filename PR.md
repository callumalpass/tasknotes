# feat-subtask-status-strip

## Subtask status indicator when status is hidden

When the status property is hidden, subtasks still show a full status dot (because they can differ from their parent). This update keeps that signal but reduces its visual weight: in that case, subtasks render a thin status-colored stripe on the right edge instead of the full dot. Main tasks keep their existing behavior.

## Changelog

### Task Cards & Note Widgets

- Mark task cards as status-hidden when the status property is not shown.
- Subtasks inherit that state and replace the status dot with a subtle right-edge stripe.
- Add styling for the subtask status stripe.
