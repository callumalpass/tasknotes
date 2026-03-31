---
id: issue-1662
provider: github
kind: issue
key: callumalpass/tasknotes#1662
external_ref: https://github.com/callumalpass/tasknotes/issues/1662
repo: callumalpass/tasknotes
number: 1662
remote_state: open
remote_title: "[Bug]: Event Creation ignores Template file properties"
remote_author: "victorhg"
remote_url: https://github.com/callumalpass/tasknotes/issues/1662
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "ICS note creation: template frontmatter properties overridden by plugin-generated defaults"
notes: |
  ## Root cause / Scope
  In `src/services/ICSNoteService.ts` around line 247–268, when creating a note from an ICS event, a default `frontmatter` object is constructed first (with `title`, `dateCreated`, `dateModified`, `tags`, `icsEventId`). If a template is provided, the processed template frontmatter is merged using `{ ...frontmatter, ...processed.frontmatter }`. Because the plugin-default object is spread first and the template second, keys that exist in both (e.g. `tags`, `title`) are correctly overridden by the template. However, additional fixed keys like `icsEventId` are always injected afterward and can clobber user-specified values. More critically, the default `tags` array (set to `icsEventTag`) overwrites whatever the user's template specifies for `tags` when the template's parsed frontmatter does not contain a `tags` key (or if the merge order was reversed in an earlier version).

  The real issue is the merge order: `{ ...frontmatter, ...processed.frontmatter }` means template wins—but the `icsEventId` field is always added to the base `frontmatter` before the spread, so it remains even if the template tries to override it with a custom key name. Users expect template properties to take full precedence.

  ## Suggested fix / Approach
  Reverse the merge or move plugin-required fields (like `icsEventId` tracking) to a post-merge step that only adds them if not already present from the template. Change the merge to `{ ...processed.frontmatter, ...requiredFields }` where `requiredFields` contains only the fields the plugin strictly needs for its own function (e.g. the ICS link field). Template-specified values for `tags`, `title`, and user-defined fields should fully replace the defaults. Single-file fix in `src/services/ICSNoteService.ts`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
