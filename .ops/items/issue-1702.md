---
id: issue-1702
provider: github
kind: issue
key: callumalpass/tasknotes#1702
external_ref: https://github.com/callumalpass/tasknotes/issues/1702
repo: callumalpass/tasknotes
number: 1702
remote_state: open
remote_title: "[Bug]: way to remove padding at bottom of views"
remote_author: "AudreyLooby"
remote_url: https://github.com/callumalpass/tasknotes/issues/1702
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "Excess bottom padding/margin on calendar and other views cannot be overridden via CSS snippets due to hardcoded inline styles"
notes: |
  ## Root cause / Scope
  In `CalendarView.ts` (`setupContainer()`), the root element's style is set via
  `style.cssText = "min-height: 800px; height: 100%; display: flex; flex-direction: column;"`.
  Similarly, the calendar element gets `style.cssText = "flex: 1; min-height: 700px; overflow: auto;"`.
  These inline styles have higher specificity than any CSS class or snippet rule, making them
  impossible to override without JavaScript. The `min-height: 800px` and `min-height: 700px` values
  create extra bottom whitespace when the container is shorter than those thresholds (e.g., in
  embedded/split-pane contexts). CSS snippets that target the relevant class selectors are overridden
  by these inline styles, matching the user's report that CSS snippets "don't work".

  ## Suggested fix / Approach
  Replace the inline `style.cssText` assignments with CSS class additions, moving the style rules
  into `advanced-calendar-view.css`. Use CSS custom properties (variables) like `--tn-calendar-min-height`
  to allow user overrides via snippets. Remove or reduce the hardcoded `min-height` values, relying
  instead on `flex: 1` to fill available space. This is a low-risk CSS-only change that would
  immediately unblock user customisation.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
