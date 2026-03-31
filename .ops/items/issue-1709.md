---
id: issue-1709
provider: github
kind: issue
key: callumalpass/tasknotes#1709
external_ref: https://github.com/callumalpass/tasknotes/issues/1709
repo: callumalpass/tasknotes
number: 1709
remote_state: open
remote_title: "[Bug]: relationship.base renders multiple times when default view is set to Reading view"
remote_author: "CarlJohnson99"
remote_url: https://github.com/callumalpass/tasknotes/issues/1709
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "Relationships widget duplicates (2-3 copies) in reading mode when the default new tab view is set to Reading view"
notes: |
  ## Root cause / Scope
  The RelationshipsDecorations reading-mode injection path (src/editor/RelationshipsDecorations.ts, injectReadingModeWidget) fires on multiple workspace events: layout-change, active-leaf-change, and metadata-cache changed. When Obsidian opens a new tab already in Reading view the events fire in rapid succession, each triggering a separate async createRelationshipsWidget call. Because the cleanup step (removing existing .tasknotes-relationships-widget elements) runs synchronously at the top of injectReadingModeWidget but the new widget is inserted only after the async MarkdownRenderer.render() call resolves, two or more concurrent invocations each complete their cleanup before the other inserts its widget, resulting in multiple widgets being appended. The ReadingModeInjectionScheduler (src/editor/ReadingModeInjectionScheduler.ts) is used for task-card injections but the same race can occur here if scheduler context staleness checks are not sufficient under rapid firing.

  ## Suggested fix / Approach
  Ensure only one in-flight injection is running per leaf at a time by cancelling/superseding previous async calls before starting a new one, similar to how debouncedInjectWidget works in the live-preview path. Apply the ReadingModeInjectionScheduler consistently to the reading-mode path so later invocations invalidate earlier async work. Add a per-leaf mutex/flag that prevents a second render from starting if one is already in flight.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
