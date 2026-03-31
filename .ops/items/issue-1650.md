---
id: issue-1650
provider: github
kind: issue
key: callumalpass/tasknotes#1650
external_ref: https://github.com/callumalpass/tasknotes/issues/1650
repo: callumalpass/tasknotes
number: 1650
remote_state: open
remote_title: "[Bug]: Google Calendar keeps getting disconnected"
remote_author: "Robubble"
remote_url: https://github.com/callumalpass/tasknotes/issues/1650
local_status: triaged
priority: high
difficulty: medium
risk: high
summary: "Google Calendar connection drops on Obsidian startup due to token refresh failures or stale persisted OAuth state"
notes: |
  ## Root cause / Scope
  `OAuthService.ts` auto-disconnects when a token refresh fails with HTTP 400 `invalid_grant` (line 560). If the refresh token has been revoked, expired (Google refresh tokens can expire after 7 days if the app is in "Testing" mode with unverified OAuth consent screen), or if the stored token is corrupted on load, the service automatically calls `disconnect()`. Additionally, the user reports "No events to display" even without a full disconnect — this may be from `GoogleCalendarService.ts` receiving a `TokenExpiredError` or from a race condition during Obsidian's startup where the OAuth tokens haven't been loaded yet when the calendar view first renders. The periodic refresh on startup (5-minute buffer in `getValidAccessToken`) may also cause a spurious reconnect cycle.

  ## Suggested fix / Approach
  (1) Distinguish between "soft" token errors (network timeout, 5xx) and "hard" errors (invalid_grant) before auto-disconnecting — only auto-disconnect on confirmed invalid_grant. (2) Add a startup retry delay so the calendar view waits for OAuth initialization before reporting no events. (3) Improve the UI to distinguish "disconnected" from "loading" vs "no events". (4) Investigate whether the token persistence (`plugin.settings` save) is properly awaited before Obsidian closes, which could cause token loss between sessions.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
