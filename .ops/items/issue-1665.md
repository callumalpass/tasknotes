---
id: issue-1665
provider: github
kind: issue
key: callumalpass/tasknotes#1665
external_ref: https://github.com/callumalpass/tasknotes/issues/1665
repo: callumalpass/tasknotes
number: 1665
remote_state: open
remote_title: "[Bug]: \"API server not accessible (API unavailable (401:Unauthorized))\""
remote_author: "warm-july"
remote_url: https://github.com/callumalpass/tasknotes/issues/1665
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "Settings UI shows 401 error when checking API accessibility after enabling auth token"
notes: |
  ## Root cause / Scope
  In `src/api/loadAPIEndpoints.ts`, the settings panel checks API accessibility by fetching `http://localhost:{port}/api/docs` without any authentication headers. The `/api/docs` endpoint is handled by `SystemController.ts` and is protected by the same auth middleware in `HTTPAPIService.ts` (line 216): all `/api/` routes require a Bearer token if `apiAuthToken` is set. When the user has configured an API auth token, this unauthenticated check receives a `401 Unauthorized` response, which is then displayed as an error even though the server is running correctly.

  ## Suggested fix / Approach
  Two options: (1) Make `/api/docs` exempt from authentication (it only returns schema information, not sensitive data), by adding it to the exclude list in `HTTPAPIService.authenticate()` or checking the path before applying auth. (2) Have the settings UI include the configured auth token as a Bearer header when making the test request. Option 1 is simpler and safer since the docs endpoint is read-only metadata. Single-file change in `src/services/HTTPAPIService.ts` or `src/api/loadAPIEndpoints.ts`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
