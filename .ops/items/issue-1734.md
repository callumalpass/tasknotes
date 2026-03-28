---
id: 'github:callumalpass/tasknotes:issue:1734'
provider: github
kind: issue
key: '1734'
external_ref: callumalpass/tasknotes#1734
repo: callumalpass/tasknotes
number: 1734
remote_state: OPEN
remote_title: >-
  [Bug]: The BlockedBy Modal doesn't filter based on search text
remote_author: MatthewClarkeDev
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1734'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  The dependency picker modal (Blocked by / Blocking) uses TaskSelectorWithCreateModal which
  has a correct getFilteredTasks implementation, but the search filtering is not working for
  users. Likely a rendering or Obsidian SuggestModal interaction issue.
notes: |-
  Root cause:
  - The dependency picker flows through TaskModal.openTaskDependencySelector() ->
    openTaskSelector() -> TaskSelectorWithCreateModal (extends Obsidian SuggestModal).
  - The getSuggestions() method (line 379) delegates to getFilteredTasks() which has correct
    filtering logic (title, due, priority, contexts, projects matching).
  - The bug likely stems from the TaskCard rendering in renderSuggestion() (line 438-449)
    which clones the card element, potentially interfering with Obsidian's suggestion container
    height calculations or result display. Alternatively, the SuggestModal's internal limit
    or re-render cycle may not be triggered properly when the suggestion list is large.
  - The handleInputChange listener (line 103) runs alongside Obsidian's built-in input handler,
    which could cause a race condition where the footer update triggers a DOM reflow that
    interferes with the suggestion list re-render.

  Suggested fix (preferred):
  - Debug the SuggestModal interaction by adding console logging to getSuggestions to confirm
    it is called on each keystroke and returns the filtered subset.
  - If getSuggestions is called but the UI doesn't update, investigate whether the TaskCard
    cloneNode in renderSuggestion is causing issues with Obsidian's suggestion container.
  - Consider adding this.limit = 100 or similar in the constructor to ensure Obsidian
    re-renders the suggestion list on each query change.

  Fallback options:
  - Replace SuggestModal with a custom modal that manages its own filtering and rendering,
    bypassing Obsidian's suggestion infrastructure entirely.
command_id: triage-issue
last_analyzed_at: '2026-03-29T00:00:00Z'
sync_state: clean
type: item_state
---
