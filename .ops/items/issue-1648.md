---
id: 'github:callumalpass/tasknotes:issue:1648'
provider: github
kind: issue
key: '1648'
external_ref: callumalpass/tasknotes#1648
repo: callumalpass/tasknotes
number: 1648
remote_state: OPEN
remote_title: >-
  [Bug]: the settings panel for "integrations" fails to load the API endpoints
  list if an API key is set
remote_author: npondel
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1648'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  The settings panel fetches `/api/docs` without sending the Bearer auth token,
  so when an API key is configured, the request returns 401 and the endpoint
  list fails to load.
notes: |-
  Root cause:
  - `src/api/loadAPIEndpoints.ts` calls `fetch(http://localhost:${apiPort}/api/docs)` with no Authorization header.
  - `src/services/HTTPAPIService.ts` line 216 checks `pathname.startsWith("/api/")` and enforces auth for all `/api/*` routes, including `/api/docs`.
  - The `/api/docs` endpoint itself (in `SystemController.ts` line 170) has no special auth exemption.

  Suggested fix (preferred):
  - Exempt the `/api/docs` and `/api/docs/ui` endpoints from authentication in `HTTPAPIService.handleRequest()` by adding a check before the auth gate at line 216.

  Fallback options:
  - Pass the API key from settings into `loadAPIEndpoints()` and include it as a Bearer token header in the fetch call.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
