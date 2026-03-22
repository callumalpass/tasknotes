---
id: 'github:callumalpass/tasknotes:issue:1702'
provider: github
kind: issue
key: '1702'
external_ref: callumalpass/tasknotes#1702
repo: callumalpass/tasknotes
number: 1702
remote_state: OPEN
remote_title: >-
  [Bug]: way to remove padding at bottom of views
remote_author: AudreyLooby
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1702'
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: >-
  Views (calendar, etc.) have a hardcoded bottom padding/margin that prevents
  them from filling the full available height. CSS snippets cannot override it,
  suggesting the constraint is applied via inline styles or JavaScript.
notes: |-
  Root cause:
  - The bottom padding is likely set in styles/bases-views.css or styles/calendar-view.css with a fixed value, or applied programmatically in the view render code (e.g. BasesViewBase or CalendarView).
  - The user reports CSS snippets cannot override it, which suggests either inline styles set by JS, or high-specificity selectors in the plugin stylesheet.

  Suggested fix (preferred):
  - Convert the fixed bottom padding to a CSS custom property (e.g. --tasknotes-view-padding-bottom) so users can override it with CSS snippets.
  - If the padding is set via JS inline styles, move it to CSS classes instead.

  Fallback options:
  - Add a "Full height views" toggle in appearance settings that removes the bottom padding.
  - Add !important-level CSS custom property support documentation so users know how to override.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
