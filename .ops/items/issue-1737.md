---
id: issue-1737
provider: github
kind: issue
key: callumalpass/tasknotes#1737
external_ref: https://github.com/callumalpass/tasknotes/issues/1737
repo: callumalpass/tasknotes
number: 1737
remote_state: open
remote_title: "[Bug]: task tag is always meant to be #task even when defined otherwise"
remote_author: "goldorak00"
remote_url: https://github.com/callumalpass/tasknotes/issues/1737
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: "Default Bases template files hard-code 'task' as the tag filter condition, ignoring the user's custom taskTag setting"
notes: |
  ## Root cause / Scope
  `src/templates/defaultBasesFiles.ts` generates `.base` filter files using `generateTaskFilterCondition()`. For the `"tag"` identification method this reads `settings.taskTag || "task"`, which is correct. However, the template generation happens only once when the view files are first created. If the user changes `taskTag` after the files exist, they are not regenerated. Additionally, `src/services/MdbaseSpecService.ts:392` correctly reads the setting at spec-generation time, but the generated `.base` files stored on disk still contain the old hard-coded value. The user's tasks are tagged `#tasknotes` but the existing `.base` filter still matches only `#task`, so no tasks appear in any view.

  ## Suggested fix / Approach
  Two complementary fixes: (1) When `taskTag` changes (detected in `SettingsLifecycleService.haveCacheSettingsChanged`), trigger a regeneration or update of all managed `.base` files via `MdbaseSpecService.onSettingsChanged()`. (2) On plugin load, compare the tag stored in existing `.base` files against the current setting and prompt (or auto-update) if they diverge. Alternatively, use a dynamic Bases formula expression that reads the property at query time rather than baking the literal tag into the file.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
