---
id: 'github:callumalpass/tasknotes:issue:1680'
provider: github
kind: issue
key: '1680'
external_ref: callumalpass/tasknotes#1680
repo: callumalpass/tasknotes
number: 1680
remote_state: OPEN
remote_title: >-
  [Bug]: Agenda view shows both TaskNotes events and property-based events despite showPropertyBasedEvents: false
remote_author: xiaoyaozhu1991
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1680'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  The showPropertyBasedEvents option set to false in the base YAML view
  options is not being read by CalendarView, likely because the Bases config
  API does not expose values nested under the options key, causing the default
  (true) to persist.
notes: |-
  Root cause:
  - CalendarView.readEventToggles() (line 463) reads
    config.get('showPropertyBasedEvents'). The default is true (line 186).
    The nullish coalescing operator (??) means if config.get returns
    undefined, the default true is kept.
  - The user's YAML places showPropertyBasedEvents inside the options sub-key.
    Obsidian's Bases config.get() may not flatten the options sub-object
    into the config namespace, so config.get('showPropertyBasedEvents')
    returns undefined.
  - Additionally, since startDateProperty is set to file.ctime and the
    base data includes tasks, even if showPropertyBasedEvents worked
    correctly, the tasks would still appear as TaskNotes events from
    generateCalendarEvents (line 950). The showPropertyBasedEvents flag
    only controls the additional property-based events layer.

  Suggested fix (preferred):
  - In readEventToggles(), also check config.get('options')?.showPropertyBasedEvents
    as a fallback, or read from the raw view data's options field directly.
  - If the Bases API config.get does support options.X nesting, debug why
    it returns undefined for this specific key.

  Fallback options:
  - Document that showPropertyBasedEvents should be set at the top level
    of the view definition, not inside an options sub-key.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
