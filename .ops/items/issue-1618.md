---
id: issue-1618
provider: github
kind: issue
key: callumalpass/tasknotes#1618
external_ref: https://github.com/callumalpass/tasknotes/issues/1618
repo: callumalpass/tasknotes
number: 1618
remote_state: open
remote_title: "[Bug]: mdBase-tasknotes cli is not recognizing my configuration in the plugin of identifying tasks"
remote_author: "jimbo108108"
remote_url: https://github.com/callumalpass/tasknotes/issues/1618
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "CLI writes hardcoded 'task' type value instead of reading the configured taskPropertyValue from _types/task.md defaults"
notes: |
  ## Root cause / Scope
  The mdbase-tasknotes CLI tool uses the type definition name ("task") as the property value when writing new task files, ignoring the `default:` field in `_types/task.md`. The plugin itself reads `taskPropertyValue` from settings (which may be "Tasks" capitalised), but the CLI independently writes "task" (lowercased singular). Additionally the reporter sees two copies of `_type/task.md` — one in vault root and one under the TaskNotes folder — which may cause the CLI to pick up the wrong configuration context.

  ## Suggested fix / Approach
  The CLI should read the `default:` field of `_types/task.md` to determine the property value to write, rather than using the type definition name verbatim. A validation warning should also be emitted when the CLI-written value diverges from the configured `taskPropertyValue`. The duplicate `_type` folder issue should be investigated to ensure CLI creates files only in the configured location.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
