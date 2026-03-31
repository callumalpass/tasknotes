---
id: issue-1667
provider: github
kind: issue
key: callumalpass/tasknotes#1667
external_ref: https://github.com/callumalpass/tasknotes/issues/1667
repo: callumalpass/tasknotes
number: 1667
remote_state: open
remote_title: "[FR]: Use NLP to populate scheduled AND/OR Due Date"
remote_author: "hokfujow"
remote_url: https://github.com/callumalpass/tasknotes/issues/1667
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: NLP date parsing should support explicit keywords to distinguish scheduled vs due date in the same input"
notes: |
  ## Root cause / Scope
  The NLP parser (`src/services/NaturalLanguageParser.ts`) currently maps a parsed date to either the scheduled or due field based on a global preference setting—it cannot differentiate within a single input string. Users who want to set both dates simultaneously must use the form fields separately, losing the speed benefit of NLP input.

  ## Suggested fix / Approach
  Add keyword prefixes (e.g. "due:", "scheduled:", "by:", "start:") to the NLP grammar so that a single input like "Start Friday Due March 13th" maps the first date to `scheduledDate` and the second to `dueDate`. The `NaturalLanguageParserCore` would need new pattern rules for each keyword, and `applyParsedData` in `TaskCreationModal.ts` already handles populating both fields independently. Medium effort touching the parser core and its tests.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
