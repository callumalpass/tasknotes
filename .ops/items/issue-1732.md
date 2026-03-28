---
id: 'github:callumalpass/tasknotes:issue:1732'
provider: github
kind: issue
key: '1732'
external_ref: callumalpass/tasknotes#1732
repo: callumalpass/tasknotes
number: 1732
remote_state: OPEN
remote_title: >-
  [FR]: Command Pallet Functions
remote_author: prepare4robots
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1732'
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: >-
  Feature request to expose "Add project to current task", "Add subtask to current task",
  and "Edit task details" as standalone commands in the Obsidian command palette. Currently
  these actions are only accessible through the quick-actions palette or context menus.
notes: |-
  Root cause:
  - Not a bug. The addCommands() method in main.ts (line 1508) registers commands but does
    not include dedicated commands for adding a project, adding a subtask, or directly opening
    the edit modal for the current task.
  - "Quick actions for current task" (id: quick-actions-current-task) exists and opens
    TaskActionPaletteModal, which is a two-step process (open palette, then pick action).
  - The user wants single-step command palette access to these specific actions.

  Suggested fix (preferred):
  - Add three new command definitions in the commandDefinitions array in addCommands():
    1. "add-project-to-current-task" - gets active file, validates it's a task, opens the
       project picker or adds project inline.
    2. "add-subtask-to-current-task" - gets active file, validates it's a task, opens the
       subtask creation flow.
    3. "edit-current-task" - gets active file, validates it's a task, opens TaskEditModal
       directly (bypassing the action palette).
  - Each command follows the same pattern as openQuickActionsForCurrentTask (line 2903):
    get active file, validate task, then perform the specific action.
  - Add corresponding i18n keys in all locale resource files.

  Fallback options:
  - Add only "edit-current-task" as the highest-value single command, since the other two
    actions are accessible from within the edit modal.
command_id: triage-issue
last_analyzed_at: '2026-03-29T00:00:00Z'
sync_state: clean
type: item_state
---
