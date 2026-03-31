---
id: issue-1623
provider: github
kind: issue
key: callumalpass/tasknotes#1623
external_ref: https://github.com/callumalpass/tasknotes/issues/1623
repo: callumalpass/tasknotes
number: 1623
remote_state: open
remote_title: "[Bug]: \"Store title in filename\" still saves title in frontmatter"
remote_author: "VenturaNotes"
remote_url: https://github.com/callumalpass/tasknotes/issues/1623
local_status: triaged
priority: medium
difficulty: easy
risk: medium
summary: "storeTitleInFilename flag is accepted by mapTaskToFrontmatter but voided with `void storeTitleInFilename`, so title is always written to frontmatter"
notes: |
  ## Root cause / Scope
  In `src/core/fieldMapping.ts`, `mapTaskToFrontmatter()` accepts `storeTitleInFilename?: boolean` as a parameter, but at line 279 it executes `void storeTitleInFilename` — effectively discarding the value and never using it. As a result, the `title` property is unconditionally written to frontmatter at line 166 regardless of this setting. PR #1608 likely removed the conditional guard that previously skipped writing the title field when `storeTitleInFilename` was true.

  ## Suggested fix / Approach
  In `mapTaskToFrontmatter`, wrap the title assignment (line 165–167) with `if (!storeTitleInFilename)` so the title field is omitted from frontmatter when the setting is enabled. Remove the `void storeTitleInFilename` no-op. Verify that `TaskUpdateService.ts` also respects this flag when updating existing files (it calls `mapToFrontmatter` with the same parameter).
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
