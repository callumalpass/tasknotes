---
id: 'github:callumalpass/tasknotes:issue:1639'
provider: github
kind: issue
key: '1639'
external_ref: callumalpass/tasknotes#1639
repo: callumalpass/tasknotes
number: 1639
remote_state: OPEN
remote_title: >-
  [Bug]: Task link overlay doesn't respect "disable overlay for aliased tasks"
  settings in reading mode
remote_author: MiracleXYZ
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1639'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  The "Disable overlay for aliased links" setting works in live preview mode but
  not in reading mode. The alias detection logic in
  ReadingModeTaskLinkProcessor compares display text against path and title but
  may fail for certain alias formats in rendered HTML.
notes: |-
  Root cause:
  - In `src/editor/ReadingModeTaskLinkProcessor.ts` lines 167-175, the alias check compares `linkEl.textContent` against `originalLinkPath` and `taskInfo.title`.
  - In reading mode, Obsidian resolves wikilink aliases differently: `[[task|alias]]` renders as `<a class="internal-link">alias</a>` where `textContent` is the alias and `href` is the resolved path.
  - The `originalLinkPath` is derived from `href` which may include `.md` extension or path components, while `textContent` is just the display text. When the display text matches the file's basename (without extension), the check incorrectly treats it as non-aliased.
  - The comparison `currentText !== originalLinkPath && currentText !== taskInfo.title` may also fail when `taskInfo.title` happens to match the alias text.

  Suggested fix (preferred):
  - Improve the alias detection by checking `linkEl.getAttribute("data-href")` or `linkEl.getAttribute("href")` against the displayed text more robustly. An alias exists when the link element's `aria-label` or `data-href` attribute differs from `textContent` in a way that isn't just path resolution.

  Fallback options:
  - Check the original markdown source to determine if a pipe alias was used, rather than relying on rendered DOM text comparison.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
