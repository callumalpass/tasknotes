---
id: 'github:callumalpass/tasknotes:issue:1656'
provider: github
kind: issue
key: '1656'
external_ref: callumalpass/tasknotes#1656
repo: callumalpass/tasknotes
number: 1656
remote_state: OPEN
remote_title: >-
  [FR]: Translation of the properties
remote_author: SKIERZZ
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1656'
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: >-
  Property labels on task cards (e.g., "Due", "Scheduled") are not translatable.
  The i18n system exists but property display names in task cards are hardcoded
  English strings rather than using translation keys.
notes: |-
  Root cause:
  - Task card property labels in `src/ui/TaskCard.ts` use hardcoded English strings or raw property names rather than i18n-translated labels.
  - The i18n infrastructure already supports multiple languages (en, fr, ru, zh, de, es, ja, pt, ko) but property display labels on cards were never wired through the translation system.

  Suggested fix (preferred):
  - Add translation keys for all property labels displayed on task cards (status, priority, due, scheduled, recurrence, etc.) to the i18n resource files.
  - Update `TaskCard.ts` to call the plugin's translate function for property display names instead of using hardcoded strings.

  Fallback options:
  - Allow users to customize property display names via settings, which would also serve as a manual translation mechanism.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
