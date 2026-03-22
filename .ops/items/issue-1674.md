---
id: 'github:callumalpass/tasknotes:issue:1674'
provider: github
kind: issue
key: '1674'
external_ref: callumalpass/tasknotes#1674
repo: callumalpass/tasknotes
number: 1674
remote_state: OPEN
remote_title: >-
  [Bug]: Timeblock Failed to find daily notes folder
remote_author: Ender367
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1674'
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: >-
  Timeblock creation fails with "Failed to find daily notes folder" because
  appHasDailyNotesPluginLoaded() from obsidian-daily-notes-interface returns false when the user
  relies on the Journals plugin instead of core Daily Notes, even when core Daily Notes is enabled
  as a workaround.
notes: |-
  Root cause:
  - In src/modals/TimeblockCreationModal.ts line 271, saveTimeblockToDailyNote() calls
    appHasDailyNotesPluginLoaded() which checks for the core Daily Notes plugin configuration.
    The obsidian-daily-notes-interface library may not detect the plugin as loaded if the folder
    config is missing or if the Journals plugin intercepts daily note creation. The error at
    B0e in the stack trace corresponds to getAllDailyNotes() failing to resolve the folder path.

  Suggested fix (preferred):
  - Catch the "daily notes folder" error and provide a more descriptive message guiding users to
    verify their Daily Notes core plugin folder setting. Additionally, add a TaskNotes setting for
    an explicit daily notes folder override that bypasses obsidian-daily-notes-interface when set.

  Fallback options:
  - Document the Journals plugin incompatibility and require users to configure the core Daily Notes
    plugin with an explicit folder path that exists on disk.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
