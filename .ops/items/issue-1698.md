---
id: issue-1698
provider: github
kind: issue
key: callumalpass/tasknotes#1698
external_ref: https://github.com/callumalpass/tasknotes/issues/1698
repo: callumalpass/tasknotes
number: 1698
remote_state: open
remote_title: "[Bug]: Inline/bulk task conversion doesn't parse both scheduled and due dates (only creation modal was fixed in #1042)"
remote_author: "serendipity-sws"
remote_url: https://github.com/callumalpass/tasknotes/issues/1698
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "Inline and bulk task conversion ignores 'scheduled' keyword NLP parsing, leaving the date literal in the task title"
notes: |
  ## Root cause / Scope
  In `InstantTaskConvertService.ts`, both the single-task conversion path (line ~225) and the bulk
  batch path (`parseTaskForBatch`, line ~1220) call `this.nlParser.parseInput(cleanTitle)` where
  `cleanTitle` is the title after TasksPluginParser has stripped emoji-based syntax (⏳, 📅, etc.).
  For natural-language tasks like "Test task due March 20 scheduled March 16", the NLP parser
  receives the full sentence. The NLP parser (from `tasknotes-nlp-core`) may correctly parse "due
  March 20" but fail to recognise "scheduled" as a date keyword that maps to `scheduledDate`.
  The fix in v4.2.1 for #1042 updated the creation modal's NLP config but the inline conversion
  uses the same `NaturalLanguageParser.fromPlugin()` instance, so if the NLP core does not support
  the "scheduled" trigger word for `scheduledDate`, that is a gap in the NLP core package. If the
  NLP core does support it, the issue may be that when both "due" and "scheduled" keywords appear,
  only one date is captured due to a first-match exit.

  ## Suggested fix / Approach
  Verify whether `tasknotes-nlp-core` maps the word "scheduled" to `scheduledDate`. If not, add
  that trigger mapping to the NLP core (or NLPTriggersConfig defaults). If the NLP core already
  handles it, check `mergeParseResults()` in `InstantTaskConvertService.ts` to ensure that when
  TasksPluginParser returns no `scheduledDate` (no emoji marker), the NLP result's `scheduledDate`
  is not overwritten by the empty fallback.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
