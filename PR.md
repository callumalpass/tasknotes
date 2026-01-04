# fix-task-prop-based-ident

## Property-based task identification preserves tags

This change prevents property-based identification from mutating tags automatically. Tags are only written when the user explicitly sets them (including default tags), while the identifying property is still applied.

Examples (illustrative):

- Creating a task with property identification and tags like `client, urgent` keeps those tags; no extra task tag is injected.
- Updating priority/status without touching tags leaves existing tags unchanged.

## Changelog

### Task Identification

- Only add the identifying task tag to frontmatter when tag-based identification is enabled.
- In property-based mode, preserve user/default tags without filtering them out.
- Only write `frontmatter.tags` during updates when tags are explicitly provided; otherwise leave tags untouched.
- Fixes callumalpass/tasknotes#1391.

### Edit modal tag safety

- Property-based identification now keeps all tags visible in the edit modal (only tag-based mode hides the task tag).
- Tags are only updated when the user actually changes the tags field, preventing accidental tag removal on unrelated edits.

## Risks / Notes

- Tags are written only on explicit changes, which is correct, but still depends on UI state. If the UI normalizes tags (order/casing) it could be interpreted as a change and re-written.
