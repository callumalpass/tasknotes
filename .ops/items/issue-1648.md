---
id: issue-1648
provider: github
kind: issue
key: callumalpass/tasknotes#1648
external_ref: https://github.com/callumalpass/tasknotes/issues/1648
repo: callumalpass/tasknotes
number: 1648
remote_state: open
remote_title: "[Bug]: the settings panel for \"integrations\" fails to load the API endpoints list if an API key is set"
remote_author: "npondel"
remote_url: https://github.com/callumalpass/tasknotes/issues/1648
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "Settings integrations panel fetch to /api/docs omits auth token, causing 401 when API auth is configured"
notes: |
  ## Root cause / Scope
  `src/api/loadAPIEndpoints.ts` performs a plain `fetch()` to `http://localhost:{port}/api/docs` with no Authorization header. In `HTTPAPIService.ts` (line 216), all `/api/` paths require authentication when `settings.apiAuthToken` is set — there is no exemption for the `/api/docs` endpoint. When an API token is configured, the server returns 401 and the settings panel displays an error instead of the endpoint list.

  ## Suggested fix / Approach
  Two equivalent options: (1) Pass the API auth token from plugin settings as a `Bearer` Authorization header in the `loadAPIEndpoints.ts` fetch call — the settings tab already has access to `plugin.settings.apiAuthToken`; (2) Exempt the `/api/docs` endpoint from authentication in `HTTPAPIService.ts` by adding a path check before the auth guard. Option 1 is safer (keeps docs protected on the network) and is a trivial one-line change to `loadAPIEndpoints.ts`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
