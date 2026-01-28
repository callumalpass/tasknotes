# fix/context-group-title

## Context Group Header Rendering

Prevent group headers from resolving plain strings as file links. Only explicit links or values that look like file paths are resolved, so context values like "STY" stay intact.

Examples (illustrative):

- Current: contexts = "STY" and a file `sty.md` exists with `title: Foo` -> header shows "Foo" (linked).
- Target: contexts = "STY" always shows "STY" as plain text.

## Changelog

- Treat non-link, non-path group titles as plain text.
- Keep file link rendering for explicit wiki/markdown links and path-like values.

## Tests

- Not run (manual testing only)
