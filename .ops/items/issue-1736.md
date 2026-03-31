---
id: issue-1736
provider: github
kind: issue
key: callumalpass/tasknotes#1736
external_ref: https://github.com/callumalpass/tasknotes/issues/1736
repo: callumalpass/tasknotes
number: 1736
remote_state: open
remote_title: "[FR]: Recurring tasks by due date"
remote_author: "kmaustral"
remote_url: https://github.com/callumalpass/tasknotes/issues/1736
local_status: triaged
priority: low
difficulty: medium
risk: medium
summary: "Feature request to anchor recurrence advancement to the due date instead of the scheduled date, clearing scheduled on each cycle"
notes: |
  ## Root cause / Scope
  The recurrence system currently computes the next occurrence date relative to the `scheduled` field. Some users have tasks with fixed `due` dates (e.g. publication deadlines) and flexible `scheduled` dates. They want recurrence to increment `due` to the next cycle date and clear `scheduled`, rather than moving `scheduled` forward. This requires a new recurrence anchor option alongside the existing `scheduled` / `completion` choices.

  ## Suggested fix / Approach
  Add a third `recurrenceAnchor` value (`"due"`) to the settings and task model. In `TaskUpdateService` (recurrence advancement logic), when `recurrenceAnchor === "due"`, compute next occurrence from `due`, write the new value to `due`, and set `scheduled` to undefined/empty. Expose the option in the recurrence UI (TaskCreationModal / TaskEditModal). No data model changes beyond the new anchor value are needed.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
