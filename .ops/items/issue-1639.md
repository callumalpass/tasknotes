---
id: issue-1639
provider: github
kind: issue
key: callumalpass/tasknotes#1639
external_ref: https://github.com/callumalpass/tasknotes/issues/1639
repo: callumalpass/tasknotes
number: 1639
remote_state: open
remote_title: "[Bug]: Task link overlay doesn't respect \"disable overlay for aliased tasks\" settings in reading mode"
remote_author: "MiracleXYZ"
remote_url: https://github.com/callumalpass/tasknotes/issues/1639
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "disableOverlayOnAlias setting is not applied in reading mode because the link text check uses wrong comparison logic"
notes: |
  ## Root cause / Scope
  Two separate processors handle task link overlays: `TaskLinkOverlay.ts` (live preview / CodeMirror) and `ReadingModeTaskLinkProcessor.ts` (reading mode). The live preview path checks `link.match.includes("|")` (i.e., the raw wikilink syntax), which is reliable. The reading mode path (`ReadingModeTaskLinkProcessor.ts` line 173) compares the rendered `linkEl.textContent` against `originalLinkPath` and `taskInfo.title` — but `originalLinkPath` is already the decoded href from Obsidian (the file path without alias), so an aliased link like `[[MyTask|Do the thing]]` will have textContent "Do the thing", linkPath "MyTask", and title "MyTask". The comparison `currentText !== originalLinkPath && currentText !== taskInfo.title` correctly returns true for a real alias, but `originalLinkPath` passed into `replaceWithTaskWidget` is the href (already resolved by Obsidian), not the raw wikilink markup, so there is no pipe character to detect. The check should work — but `originalLinkPath` is derived from `linkEl.getAttribute("href")` which may equal the decoded file path (not the title), causing the alias exclusion to occasionally fail when the file name matches the title.

  ## Suggested fix / Approach
  Align the reading mode alias check with the live preview approach: store the original raw wikilink text before Obsidian processes it, or simply check whether `linkEl.textContent` differs from the resolved file basename. A safer fix is to check in `processLink` whether the rendered anchor text differs from the destination file's base name (without extension). This is a single-file fix in `ReadingModeTaskLinkProcessor.ts`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
