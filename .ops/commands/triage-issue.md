# triage-issue

Triage an individual GitHub issue for the callumalpass/tasknotes repository.

## Steps

1. Read the issue details (title, body, labels, author, URL).
2. Classify the issue:
   - **Bug**: labeled `bug` or title starts with `[Bug]`
   - **FR**: labeled `enhancement` or title starts with `[FR]`
   - **Other**: anything else
3. Analyze the issue:
   - For bugs: identify root cause in `src/`, list affected files/functions.
   - For FRs: describe scope, approach, and affected components.
4. Create `.ops/items/issue-{number}.md` with frontmatter fields (see schema below).
5. For bugs: create a skipped reproduction test in `tests/unit/issues/issue-{number}-{slug}.test.ts`.

## Sidecar schema

```yaml
---
id: issue-{number}
provider: github
kind: issue
key: callumalpass/tasknotes#{number}
external_ref: https://github.com/callumalpass/tasknotes/issues/{number}
repo: callumalpass/tasknotes
number: {number}
remote_state: open
remote_title: "{title}"
remote_author: "{author}"
remote_url: https://github.com/callumalpass/tasknotes/issues/{number}
local_status: triaged
priority: high|medium|low
difficulty: easy|medium|hard
risk: low|medium|high
summary: "{one-line summary}"
notes: |
  ## Root cause / Scope
  {analysis}

  ## Suggested fix / Approach
  {approach}
command_id: triage-issue
last_analyzed_at: "{ISO date}"
sync_state: clean
type: item_state
---
```

## Priority heuristics
- **high**: data loss, crash, auth failure, widely-reported
- **medium**: functional regression, visible UI bug
- **low**: cosmetic, edge-case, minor UX

## Difficulty heuristics
- **easy**: single-file fix, off-by-one, missing field
- **medium**: multi-component change, state management
- **hard**: architectural change, new integration, security-sensitive

## Risk heuristics
- **low**: isolated change, well-tested area
- **medium**: touches shared services/utilities
- **high**: core data path, recurring tasks, auth, sync
