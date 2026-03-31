---
id: issue-1680
provider: github
kind: issue
key: callumalpass/tasknotes#1680
external_ref: https://github.com/callumalpass/tasknotes/issues/1680
repo: callumalpass/tasknotes
number: 1680
remote_state: open
remote_title: "[Bug]: Agenda view shows both TaskNotes events and property-based events despite showPropertyBasedEvents: false"
remote_author: "xiaoyaozhu1991"
remote_url: https://github.com/callumalpass/tasknotes/issues/1680
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "showPropertyBasedEvents: false in .base options not respected; property-based events still appear in agenda view"
notes: |
  ## Root cause / Scope
  In `src/bases/CalendarView.ts`, `viewOptions.showPropertyBasedEvents` is initialized to `true` (line 219). During `updateViewOptions()` (line 499), it is updated from `config.get('showPropertyBasedEvents') ?? this.viewOptions.showPropertyBasedEvents`. If `config.get()` returns `null` or `undefined` (e.g. because the `options` sub-key in the `.base` file is not being deserialized into the Bases config layer correctly), the `??` operator falls back to the default `true`, ignoring the user's `false` setting. The property-based events guard at line 1106 then sees `showPropertyBasedEvents === true` and always includes them. Additionally, the user's config has `startDateProperty: file.ctime` set at the view level, which further satisfies the condition.

  The bug likely stems from how the Bases config layer reads values from the `options:` sub-object in `.base` YAML — the key `showPropertyBasedEvents` may not be mapped correctly when it's nested under `options:` rather than at the top level.

  ## Suggested fix / Approach
  Audit the Bases config parsing for the `tasknotesCalendar` type to verify that `options.showPropertyBasedEvents` from the YAML is surfaced as `config.get('showPropertyBasedEvents')`. If the config adapter flattens the `options` sub-object, ensure the key is correctly mapped. If `config.get` can legitimately return `undefined` for a boolean toggle, consider using an explicit `!== false` check rather than `?? true`. Medium difficulty as it involves the config/registration layer.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
