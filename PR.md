# fix/render-hierarchical-tags

Fixes: https://github.com/callumalpass/tasknotes/issues/1428

## Fix hierarchical tags in Agenda

Render hierarchical tags with slashes (e.g., #g/tog) as a single tag token in Agenda/Task list views. This prevents the slash suffix from being rendered as plain text.

Examples (illustrative):

- #g/tog renders as one tag
- #project/sub-project renders as one tag

## Changelog

- expand tag regex in link text rendering to include slashes
- enable regression test for hierarchical tag rendering in link text

## Tests

- npm run test:unit -- --runTestsByPath tests/unit/issues/issue-1428-hashtags-with-slashes.test.ts
