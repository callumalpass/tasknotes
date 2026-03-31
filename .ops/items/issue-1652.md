---
id: issue-1652
provider: github
kind: issue
key: callumalpass/tasknotes#1652
external_ref: https://github.com/callumalpass/tasknotes/issues/1652
repo: callumalpass/tasknotes
number: 1652
remote_state: open
remote_title: "[Bug]: API/MCP task creation ignores filename format setting (Zettelkasten)"
remote_author: "36mimu36"
remote_url: https://github.com/callumalpass/tasknotes/issues/1652
local_status: triaged
priority: medium
difficulty: easy
risk: medium
summary: "Tasks created via API/MCP use title as filename regardless of filename format settings when storeTitleInFilename default is true"
notes: |
  ## Root cause / Scope
  `TaskCreationService.ts` calls `generateTaskFilename()` which first checks `settings.storeTitleInFilename` (line 136). The default value is `true` (`src/settings/defaults.ts` line 275). The API/MCP creation path goes through the same `TaskCreationService`, so if `storeTitleInFilename` is still true in the plugin's loaded settings, the title is used as the filename regardless of `taskFilenameFormat`. The user reports turning "Save title in filename" OFF in the UI, but if this setting isn't properly persisted or the API reads a stale copy of settings, it would continue using the title. Additionally, the UI setting label is "Save title in filename" — turning it OFF should set `storeTitleInFilename = false` — but the default is `true`, meaning for new installs or after plugin reinstall, the behavior defaults to title-as-filename.

  ## Suggested fix / Approach
  Verify that `plugin.settings.storeTitleInFilename` is correctly set to `false` when the user toggles the setting off. Check if there is a settings migration or defaults-merging step that could reset this field to `true`. The API and MCP paths both call `taskService.createTask()` which calls `generateTaskFilename(context, plugin.settings)`, so the same settings object is used — confirming the bug is in settings state, not the API code path itself.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
