---
id: issue-1633
provider: github
kind: issue
key: callumalpass/tasknotes#1633
external_ref: https://github.com/callumalpass/tasknotes/issues/1633
repo: callumalpass/tasknotes
number: 1633
remote_state: open
remote_title: "[Bug]: Interactive Task UI ignores i18n translations and field mappings (Hardcoded labels like \"Due:\", \"Scheduled:\", \"Recurring:\")"
remote_author: "Sarryaz"
remote_url: https://github.com/callumalpass/tasknotes/issues/1633
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "Task cards in .base views display hardcoded English property labels, ignoring uiLanguage translations and custom fieldMapping display names"
notes: |
  ## Root cause / Scope
  `getTaskCardPropertyLabel()` in `src/ui/taskCardHelpers.ts` uses i18n-translated strings from the `ui.taskCard.labels.*` namespace as fallbacks, but the `resolveTaskCardPropertyLabel()` function only looks up `propertyLabels` passed via `TaskCardOptions`. When rendering task cards in Bases views, the caller does not populate `propertyLabels` with the display names from `fieldMapping` or the i18n-state-manager. The standard file list in Bases uses a different rendering path that reads field display names directly. The sidebar shortcut views are also affected because they share the same task card render path without passing `propertyLabels`.

  ## Suggested fix / Approach
  When building `TaskCardOptions` for rendering in Bases / agenda views, populate `propertyLabels` by calling `plugin.fieldMapper` to resolve the display name for each property, or by querying the i18n state manager. Ensure this is done in the bases rendering path (e.g., in `src/bases/TaskListView.ts`) and passed through to the `TaskCard` constructor. The `getTaskCardPropertyLabel` fallback chain already exists — it just needs the caller to supply non-empty `propertyLabels`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
