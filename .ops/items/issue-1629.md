---
id: issue-1629
provider: github
kind: issue
key: callumalpass/tasknotes#1629
external_ref: https://github.com/callumalpass/tasknotes/issues/1629
repo: callumalpass/tasknotes
number: 1629
remote_state: open
remote_title: "[Bug]: `blockedBy` field not saved on create task"
remote_author: "obsilover"
remote_url: https://github.com/callumalpass/tasknotes/issues/1629
local_status: triaged
priority: medium
difficulty: easy
risk: medium
summary: "blockedBy selections in TaskCreationModal are passed to TaskCreationService but never included in completeTaskData, so they are dropped from the created file"
notes: |
  ## Root cause / Scope
  In `TaskCreationModal.ts`, `buildTaskCreationData()` (around line 1336–1341) correctly populates `taskData.blockedBy`. However, in `src/services/task-service/TaskCreationService.ts`, the `completeTaskData` object built at line 90 never includes a `blockedBy` key — there is no `blockedBy: taskData.blockedBy` assignment. The `mapTaskToFrontmatter` call at line 131 receives `completeTaskData`, which lacks `blockedBy`, so the field is absent from the written frontmatter. The Edit modal works because it uses a different code path (`TaskUpdateService.ts`) that reads `blockedBy` directly from the modal state and writes it via the metadata update API.

  ## Suggested fix / Approach
  In `TaskCreationService.ts`, add `blockedBy: taskData.blockedBy` to the `completeTaskData` object (alongside the other optional fields). This is a one-line addition. Confirm that `fieldMapping.ts`'s `mapTaskToFrontmatter` already handles the `blockedBy` field correctly (it does, at lines 242–253).
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
