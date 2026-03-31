---
id: issue-1674
provider: github
kind: issue
key: callumalpass/tasknotes#1674
external_ref: https://github.com/callumalpass/tasknotes/issues/1674
repo: callumalpass/tasknotes
number: 1674
remote_state: open
remote_title: "[Bug]: Timeblock Failed to find daily notes folder"
remote_author: "Ender367"
remote_url: https://github.com/callumalpass/tasknotes/issues/1674
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: "Timeblock creation fails with 'Failed to find daily notes folder' when daily note folder doesn't exist on disk"
notes: |
  ## Root cause / Scope
  `addTimeblockToDailyNote()` in `src/utils/helpers.ts` calls `createDailyNote(moment)` from the `obsidian-daily-notes-interface` library. This library reads the Daily Notes core plugin's configured folder and throws "Failed to find daily notes folder" (error code matching `OA: Failed to find daily notes folder` in the stack trace) if that folder does not exist in the vault. Users who use the Journals plugin (or other daily note plugins) as their primary daily note system, and who merely activate the core Daily Notes plugin as a workaround, still hit this error if the configured folder path doesn't exist as a real directory in their vault.

  The `obsidian-daily-notes-interface` library's `createDailyNote` attempts to locate and validate the configured folder before creating the file, and fails hard if the folder is absent rather than creating it on demand.

  ## Suggested fix / Approach
  Before calling `createDailyNote`, check whether the configured daily notes folder exists and create it if necessary using `app.vault.createFolder()`. Alternatively, catch the specific "Failed to find daily notes folder" error and attempt folder creation then retry. A better long-term fix is to also check the Periodic Notes plugin's configuration (via `obsidian-daily-notes-interface`'s `appHasDailyNotesPluginLoaded` helper) and surface a clear settings UI for pointing timeblocks at a specific folder independent of the Daily Notes plugin. Medium difficulty as it involves error recovery and potentially a new settings field.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
