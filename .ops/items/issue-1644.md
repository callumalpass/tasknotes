---
id: 'github:callumalpass/tasknotes:issue:1644'
provider: github
kind: issue
key: '1644'
external_ref: callumalpass/tasknotes#1644
repo: callumalpass/tasknotes
number: 1644
remote_state: OPEN
remote_title: >-
  [Bug]: Default Filter on This Week View Broken for Recurring Tasks
remote_author: bkennedy-improving
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1644'
local_status: done
priority: high
difficulty: easy
risk: low
summary: >-
  Fixed by updating generated default task view filters so a missing
  `complete_instances` property is treated as "not completed today," and by
  updating the default base template docs to match the generated YAML.
notes: |-
  Root cause:
  - In `src/templates/defaultBasesFiles.ts`, all recurring task filters use the pattern `!completeInstances.contains(today().format("yyyy-MM-dd"))` without a fallback for when `complete_instances` is undefined/empty.
  - When a recurring task has never been completed, `complete_instances` is not present in the frontmatter, so the `.contains()` call on undefined returns undefined rather than true.
  - This affects the Today, This Week, Overdue, Not Blocked, and Unscheduled views -- all share the same filter pattern.

  Implemented:
  - Updated `src/templates/defaultBasesFiles.ts` so generated recurring-task filters in Not Blocked, Today, Overdue, This Week, and Unscheduled use `complete_instances.isEmpty()` as a fallback alongside `!complete_instances.contains(...)`.
  - Updated `docs/views/default-base-templates.md` so the reference examples match the generator output.
  - Added a user-facing release note entry in `docs/releases/unreleased.md`.

  Fallback options:
  - Modify the filter evaluation engine (`BasesFilterConverter` or `FilterService`) to treat `.contains()` on undefined/null as returning false (so `!undefined.contains(x)` returns true).
  
  Verification:
  - `npm run build:test` passed.
  - `obsidian plugin:reload id=tasknotes` could not be completed from the agent environment because the CLI could not connect to the Obsidian main process.
command_id: address-issue
last_analyzed_at: '2026-03-23T00:00:00Z'
sync_state: clean
type: item_state
---
