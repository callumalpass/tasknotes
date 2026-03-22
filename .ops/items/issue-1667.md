---
id: 'github:callumalpass/tasknotes:issue:1667'
provider: github
kind: issue
key: '1667'
external_ref: callumalpass/tasknotes#1667
repo: callumalpass/tasknotes
number: 1667
remote_state: OPEN
remote_title: >-
  [FR]: Use NLP to populate scheduled AND/OR Due Date
remote_author: hokfujow
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1667'
local_status: triaged
priority: medium
difficulty: medium
risk: low
summary: >-
  Feature request to allow NLP input to specify both scheduled and due dates simultaneously using
  trigger words like "Start Friday Due March 13th", rather than the current behavior where only
  one date type is populated based on the nlpDefaultToScheduled setting.
notes: |-
  Root cause:
  - Not a bug. The NaturalLanguageParserCore only extracts a single date and routes it to either
    scheduled or due based on the nlpDefaultToScheduled flag. It does not support dual-date
    extraction with distinct trigger keywords.

  Suggested fix (preferred):
  - Extend the NLP core parser to recognize trigger words for each date type (e.g. "due", "start",
    "scheduled") and populate both parsed.due and parsed.scheduled independently. The
    nlpDefaultToScheduled setting becomes the fallback when no explicit trigger word is used.

  Fallback options:
  - Support a secondary NLP trigger (e.g. "due:" prefix) that overrides the default date target
    for just that token, keeping the single-parse architecture.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
