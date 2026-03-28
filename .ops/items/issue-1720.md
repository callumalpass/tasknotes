---
id: 'github:callumalpass/tasknotes:issue:1720'
provider: github
kind: issue
key: '1720'
external_ref: callumalpass/tasknotes#1720
repo: callumalpass/tasknotes
number: 1720
remote_state: OPEN
remote_title: >-
  [Bug]: tasknotesTaskList renders date-like Bases values as icon names (e.g. clock) and ignores property display names
remote_author: Sirnii
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1720'
local_status: done
priority: high
difficulty: easy
risk: low
summary: >-
  extractBasesValue() in TaskCard.ts returns the raw icon token (e.g. "clock") for date-like
  Bases values instead of the human-readable display string, and renderGenericProperty() uses
  raw property IDs instead of Bases display names for labels.
notes: |-
  Root cause:
  - Two bugs in src/ui/TaskCard.ts:
    1. extractBasesValue() (lines 575-578) returns v.data before checking v.display or v.date
       for non-link Bases value objects. For date-like values, v.data holds the icon token
       (e.g. "clock") while v.display holds the human-readable text.
    2. renderGenericProperty() (lines 1169-1178) derives labels from the raw propertyId
       (e.g. "formula.lastTouched" -> "lastTouched") instead of using the Bases display name
       already captured by getBasesVisibleProperties() in helpers.ts.
  - Additionally, the date fallback on line 580 only checks for "lucide-calendar" icon, missing
    other date-related icons like "lucide-clock".

  Suggested fix (preferred):
  - In extractBasesValue(), for non-link objects, check v.display first, then v.date, then v.data
    as fallback. Remove the icon === "lucide-calendar" guard on the date check.
  - Pass the Bases display name map through to renderGenericProperty() or look it up from the
    Bases config so labels use configured display names instead of raw IDs.

  Fallback options:
  - Only fix the value extraction order and leave display name labels for a follow-up.

  Progress update 2026-03-29:
  - Updating `extractBasesValue()` to prefer `display`, then `date`, then `data` for non-link
    Bases values so date-like fields stop rendering icon tokens such as `clock`.
  - Threading Bases `config.getDisplayName(...)` labels into TaskCard generic-property rendering
    for Bases-backed views.
  - Adding focused regression coverage for the extraction order and display-name plumbing.
  - Verified with `pnpm exec jest tests/unit/issues/issue-1720-bases-date-value-icon-rendering.test.ts --runInBand`,
    `npm run build:test`, `obsidian plugin:reload id=tasknotes`, and `obsidian dev:errors`.
command_id: address-issue
last_analyzed_at: '2026-03-29T09:30:00Z'
sync_state: clean
type: item_state
---
