---
id: 'github:callumalpass/tasknotes:issue:1707'
provider: github
kind: issue
key: '1707'
external_ref: callumalpass/tasknotes#1707
repo: callumalpass/tasknotes
number: 1707
remote_state: OPEN
remote_title: >-
  [FR]: Add TickTick integration
remote_author: anareaty
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1707'
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: >-
  Feature request to add TickTick two-way sync via their API. TickTick's property
  model aligns well with TaskNotes frontmatter, but a full integration requires
  OAuth, field mapping, and conflict resolution similar to GoogleCalendarService.
notes: |-
  Root cause:
  - Not a bug. No TickTick integration exists. Would require a new service similar to GoogleCalendarService or MicrosoftCalendarService.

  Suggested fix (preferred):
  - Create a new TickTickService following the pattern of GoogleCalendarService (OAuth flow via OAuthService, REST API calls, field mapping).
  - Map TickTick task properties (title, dueDate, priority, tags, etc.) to TaskNotes frontmatter fields via FieldMapper.
  - Add settings UI in integrationsTab.ts.

  Fallback options:
  - Start with one-way export only (TaskNotes -> TickTick) to reduce scope.
  - Recommend community plugin or Zapier/n8n integration as interim solution.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
