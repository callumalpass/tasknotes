---
id: issue-1743
provider: github
kind: issue
key: callumalpass/tasknotes#1743
external_ref: https://github.com/callumalpass/tasknotes/issues/1743
repo: callumalpass/tasknotes
number: 1743
remote_state: open
remote_title: "[FR]: Image previews in calendar cells"
remote_author: "eugenedefox"
remote_url: https://github.com/callumalpass/tasknotes/issues/1743
local_status: triaged
priority: low
difficulty: hard
risk: low
summary: "Feature request to display a cover image thumbnail in calendar day cells, with hover-to-enlarge, sourced from a frontmatter 'cover' field"
notes: |
  ## Root cause / Scope
  The calendar day-cell renderer in `CalendarView.ts` currently only shows task titles and counts. To support image thumbnails it would need to: read a `cover` frontmatter field from linked notes, resolve the embedded image path via Obsidian's resource URL API, inject an `<img>` element into the day-cell DOM, and add CSS for thumbnail sizing and hover zoom. The scope is limited to month-view cells and is purely additive with no risk to existing data.

  ## Suggested fix / Approach
  Add an optional `cover` property to the task/note model. In the FullCalendar day-cell rendering callback (`dayCellContent` or `dayCellDidMount`), look up notes linked to that date, check for a `cover` field, resolve it with `app.vault.getResourcePath()`, and append a styled `<img>` element. Add CSS for `.calendar-cell-cover` with `object-fit: cover` sizing and a `:hover` scale transition. Gate behind a plugin setting "Show cover images in calendar".
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
