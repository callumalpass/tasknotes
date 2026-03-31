---
id: issue-1707
provider: github
kind: issue
key: callumalpass/tasknotes#1707
external_ref: https://github.com/callumalpass/tasknotes/issues/1707
repo: callumalpass/tasknotes
number: 1707
remote_state: open
remote_title: "[FR]: Add TickTick integration"
remote_author: "anareaty"
remote_url: https://github.com/callumalpass/tasknotes/issues/1707
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: "Feature request to add two-way sync with the TickTick task management app via its API"
notes: |
  ## Root cause / Scope
  This is a feature request to integrate TaskNotes with the TickTick external task management platform. TickTick exposes an OAuth-based OpenAPI that could allow bidirectional sync of task data. The codebase already contains patterns for external calendar integrations (Google Calendar, Microsoft Calendar, ICS subscriptions) in src/services/, which suggests a TickTick service could follow a similar pattern. However, property mapping would be non-trivial because TickTick's schema differs from TaskNotes' frontmatter model.

  ## Suggested fix / Approach
  Add a new TickTickService (similar to GoogleCalendarService / MicrosoftCalendarService) that handles OAuth flow via the existing OAuthService pattern. Define a FieldMapper configuration for TickTick-to-TaskNotes property translation. Provide a settings UI section under Integrations. The main complexity is schema alignment (priorities, statuses, recurrence) and conflict resolution on sync. Scope is broad; a minimal first pass could do one-way import only.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
