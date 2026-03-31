---
id: issue-1732
provider: github
kind: issue
key: callumalpass/tasknotes#1732
external_ref: https://github.com/callumalpass/tasknotes/issues/1732
repo: callumalpass/tasknotes
number: 1732
remote_state: open
remote_title: "[FR]: Command Pallet Functions"
remote_author: "prepare4robots"
remote_url: https://github.com/callumalpass/tasknotes/issues/1732
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "Feature request to expose 'Add project', 'Add subtask', and 'Edit task details' actions directly in the command palette"
notes: |
  ## Root cause / Scope
  Currently these actions live only in context menus or the quick-actions panel. The user wants them registered as Obsidian commands so they are reachable via the command palette (and assignable hotkeys). The relevant actions exist in `src/components/TaskContextMenu.ts` and `src/modals/TaskModal.ts`; they just need to be wrapped in `TranslatedCommandRegistry` / `taskNotesCommands.ts` entries that operate on the currently active task note.

  ## Suggested fix / Approach
  Register three new commands in `src/commands/taskNotesCommands.ts`:
  1. "Add project to current task" — reads the active file, checks it is a task, opens `ProjectSelectModal`.
  2. "Add subtask to current task" — same guard, calls the existing add-subtask flow.
  3. "Edit task details" — same guard, opens `TaskEditModal` for the active file.
  Each command should be context-aware (active when a task note is open) using Obsidian's `checkCallback` pattern.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
