---
id: 'github:callumalpass/tasknotes:issue:1698'
provider: github
kind: issue
key: '1698'
external_ref: callumalpass/tasknotes#1698
repo: callumalpass/tasknotes
number: 1698
remote_state: OPEN
remote_title: >-
  [Bug]: Inline/bulk task conversion doesn't parse both scheduled and due dates
  (only creation modal was fixed in #1042)
remote_author: serendipity-sws
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1698'
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: >-
  The inline/bulk task conversion code path in InstantTaskConvertService does not
  parse both scheduled and due date NLP triggers simultaneously; only the creation
  modal parser was fixed in #1042. The scheduled keyword is left as literal text
  in the title and a default date is applied instead.
notes: |-
  Root cause:
  - The NLP fix for #1042 (dual date parsing in NaturalLanguageParser.parseUnifiedDatesAndTimes) was applied to the creation modal path but the inline conversion path in InstantTaskConvertService has a separate merge flow.
  - In InstantTaskConvertService, the merge function at line ~965 uses `tasksPluginData.scheduledDate || nlpData.scheduledDate`. TasksPluginParser only recognizes emoji-based scheduled dates (e.g. the hourglass emoji), not the NLP keyword "scheduled". So for plain text input like "scheduled March 16", TasksPluginParser returns no scheduledDate, and the NLP parser should provide it.
  - The issue appears to be that the NLP parser itself may still have the early-return bug when processing both triggers in the inline path, or the clean title passed to NLP from TasksPluginParser has already had the "due" portion stripped, leaving NLP to handle "scheduled" alone but failing.
  - The reporter confirms both orderings fail, and ISO dates don't help, pointing to the NLP trigger loop still returning early for the inline code path.

  Suggested fix (preferred):
  - Ensure the NaturalLanguageParser.parseUnifiedDatesAndTimes() processes all trigger patterns without early return (the #1042 fix) and verify that the InstantTaskConvertService's NLP invocation at lines ~221-245 properly passes through both date results.
  - Verify the mergeParseResults function (line ~960) correctly picks up nlpData.scheduledDate when tasksPluginData.scheduledDate is empty.

  Fallback options:
  - Add explicit "scheduled" keyword detection in TasksPluginParser alongside the emoji patterns, so both code paths benefit.
  - Add a dedicated dual-date extraction step in InstantTaskConvertService before merging.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
