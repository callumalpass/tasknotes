# fix/project-card-refresh

## Refresh project cards after subtask edits

Project cards now refresh immediately when subtasks are added or removed via the edit modal. This ensures the project indicator and subtask list update without requiring a manual reload.

Examples (illustrative):

- Assigning subtasks to a task now turns it into a project card right after Save.
- Removing the last subtask now returns the card to a normal task immediately.

## Changelog

- Invalidate the project index after subtask edits in the task edit modal.
- Emit a task-updated event for the parent task to refresh visible views.

## Risks / Notes

- This is a minimal fix and does not address the broader, system-wide refresh architecture. A more robust approach is under discussion in: https://github.com/callumalpass/tasknotes/issues/1423
- The project index invalidation is global, which can be more expensive in large vaults. This is an intentional trade-off for immediate correctness.

## Tests

- Not run (manual testing only)
