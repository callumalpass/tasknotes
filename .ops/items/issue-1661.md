---
id: issue-1661
provider: github
kind: issue
key: callumalpass/tasknotes#1661
external_ref: https://github.com/callumalpass/tasknotes/issues/1661
repo: callumalpass/tasknotes
number: 1661
remote_state: open
remote_title: "[FR]: Looking forward to supporting CalDAV server task synchronization for Synology Calendar."
remote_author: "shileiye"
remote_url: https://github.com/callumalpass/tasknotes/issues/1661
local_status: triaged
priority: low
difficulty: hard
risk: high
summary: "FR: Add CalDAV server support for self-hosted task/calendar synchronization"
notes: |
  ## Root cause / Scope
  TaskNotes currently integrates with Google Calendar and Microsoft Calendar via OAuth, plus ICS subscription imports. There is no CalDAV client implementation, which would enable two-way sync with self-hosted servers (Synology Calendar, Nextcloud, Radicale, etc.) without relying on third-party cloud vendors. This is a privacy-focused use case.

  ## Suggested fix / Approach
  Requires a new CalDAV client service parallel to `GoogleCalendarService` and `MicrosoftCalendarService`. Would need: CalDAV PROPFIND/REPORT HTTP methods, VTODO and VEVENT parsing/serialization, authentication (Basic, Digest, OAuth2), and a new settings section. This is a substantial new integration touching core data paths and sync logic. Consider starting with read-only ICS pull (already partially covered) before adding two-way sync.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
