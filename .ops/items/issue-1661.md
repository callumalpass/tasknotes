---
id: 'github:callumalpass/tasknotes:issue:1661'
provider: github
kind: issue
key: '1661'
external_ref: callumalpass/tasknotes#1661
repo: callumalpass/tasknotes
number: 1661
remote_state: OPEN
remote_title: >-
  [FR]: Looking forward to supporting CalDAV server task synchronization for Synology Calendar.
remote_author: shileiye
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1661'
local_status: triaged
priority: low
difficulty: complex
risk: high
summary: >-
  Feature request for CalDAV protocol support to sync tasks with self-hosted calendar servers
  (e.g. Synology Calendar) rather than relying on third-party cloud providers.
notes: |-
  Root cause:
  - Not a bug. TaskNotes currently supports Google Calendar and Outlook via OAuth-based APIs.
    There is no CalDAV client implementation.

  Suggested fix (preferred):
  - Implement a CalDAV client service (similar to the existing Google/Outlook sync services) that
    supports VTODO and VEVENT operations over standard CalDAV. Use a library like tsdav or
    implement basic PROPFIND/REPORT/PUT against a user-configured CalDAV endpoint. This is a
    large feature requiring new settings UI, auth handling, and bidirectional sync logic.

  Fallback options:
  - Support ICS file export/import as an intermediate step, allowing users to manually sync via
    .ics files with their CalDAV server.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
