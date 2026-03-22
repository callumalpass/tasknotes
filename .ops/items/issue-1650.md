---
id: 'github:callumalpass/tasknotes:issue:1650'
provider: github
kind: issue
key: '1650'
external_ref: callumalpass/tasknotes#1650
repo: callumalpass/tasknotes
number: 1650
remote_state: OPEN
remote_title: >-
  [Bug]: Google Calendar keeps getting disconnected
remote_author: Robubble
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1650'
local_status: triaged
priority: high
difficulty: hard
risk: medium
summary: >-
  Google Calendar integration repeatedly disconnects on Obsidian startup and
  intermittently shows "No events to display." The OAuth token refresh flow in
  GoogleCalendarService likely fails silently, causing the connection to drop.
notes: |-
  Root cause:
  - `GoogleCalendarService` throws `TokenExpiredError` when API calls fail with auth errors (lines ~696, 807, 851, 895), but the token refresh/retry logic may not be reliably re-authenticating on startup.
  - The "No events" state on startup suggests the calendar provider's initialization races with token validation -- events are fetched before the token is refreshed.
  - Full disconnection implies the stored OAuth credentials are being cleared or invalidated, possibly by an unhandled error in the refresh flow.

  Suggested fix (preferred):
  - Audit the token refresh flow in `GoogleCalendarService` and `OAuthService` to ensure refresh tokens are persisted and retried before falling back to disconnection.
  - Add a startup initialization gate that waits for token validation before fetching events.

  Fallback options:
  - Add automatic reconnection retry with exponential backoff when `TokenExpiredError` is caught.
  - Display a more informative notice to the user when the token expires rather than silently showing empty events.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
