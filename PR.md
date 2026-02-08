# feat/kanban-sticky-headers

## Keep kanban column headers visible while scrolling

This change keeps kanban column headers visible during vertical scrolling by making the board the vertical scroll container and pinning column headers. It avoids JS logic and preserves existing drag-and-drop behavior.

Examples (illustrative):

- Long kanban columns keep their headers visible while scrolling vertically.
- Swimlane boards keep the header row pinned and column headers readable.

## Changelog

- make kanban board the vertical scroll container
- pin column headers with sticky positioning
- ensure Bases kanban root allows board scrolling

## Tests

- npm run i18n:sync
- npm run lint (warnings only; no errors)
- node generate-release-notes-import.mjs
- npm run typecheck
- npm run test:ci -- --verbose (fails in both ./main and this branch: tests/unit/issues/due-date-timezone-inconsistency.test.ts)
- npm run test:integration
- npm run test:performance (pass: no tests found)
- npm run build (warning: missing GOOGLE_OAUTH_CLIENT_ID / MICROSOFT_OAUTH_CLIENT_ID)
- npm run test:build
- Manual: verified sticky headers in Obsidian after force reload
