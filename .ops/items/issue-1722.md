---
id: 'github:callumalpass/tasknotes:issue:1722'
provider: github
kind: issue
key: '1722'
external_ref: callumalpass/tasknotes#1722
repo: callumalpass/tasknotes
number: 1722
remote_state: OPEN
remote_title: >-
  [Bug]: Inline task conversion created duplicates in Kanban view until a refresh is done.
remote_author: literallydope
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1722'
local_status: triaged
priority: medium
difficulty: medium
risk: low
summary: >-
  When an inline task is converted to a tasknote file, the Kanban view shows both the old inline
  task entry and the new tasknote as separate cards until the view is manually refreshed.
notes: |-
  Root cause:
  - When converting an inline task to a tasknote, the original inline task is removed from the
    source note and a new file is created. The Bases data layer receives the new file event and
    adds it to the data set, but the stale inline task entry (keyed by source file path + line)
    may persist in the Kanban's currentTaskElements map and taskInfoCache until the next full
    data refresh from Bases. The KanbanView.handleTaskUpdate() just calls debouncedRefresh(),
    but if Bases itself hasn't removed the old inline item from its data set by the time of the
    refresh, both appear.
  - The BasesViewBase.onDataUpdated() is debounced, so there may be a window where the old
    inline entry and the new tasknote file both exist in the Bases query results.

  Suggested fix (preferred):
  - In the conversion flow (TaskService or the convert command), explicitly invalidate/remove the
    old inline task entry from the Kanban's taskInfoCache and currentTaskElements map after
    conversion, or trigger a forced full re-render rather than relying on debounced refresh.
  - Alternatively, add deduplication logic in identifyTaskNotesFromBasesData() that detects when
    an inline task and a tasknote file represent the same task (same title/path reference).

  Fallback options:
  - Reduce the debounce delay for data updates triggered by file creation events.
  - Add a post-conversion callback that forces a synchronous view refresh.
command_id: triage-issue
last_analyzed_at: '2026-03-26T00:03:00Z'
sync_state: clean
type: item_state
---
