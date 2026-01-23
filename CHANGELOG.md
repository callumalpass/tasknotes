---
title: Integration Changelog
---

# Backlog

Planned work not yet started. Ideas and upcoming features.

# Drafts

Work in progress or implemented changes that are not yet published as upstream PRs.

## Active

Currently being built in `drft/` and not merged into `intg`.

## Integrated

Merged into `intg`, but not yet published as upstream PRs.

### feat/kanban-sticky-headers

Summary:
- Keeps kanban column headers visible during vertical scrolling.

Changes:
- Make the kanban board the vertical scroll container.
- Pin column headers with sticky positioning.
- Ensure Bases kanban root allows board scrolling.

Tests:
- `npm run i18n:sync`
- `npm run lint` (warnings only; no errors)
- `node generate-release-notes-import.mjs`
- `npm run typecheck`
- `npm run test:ci -- --verbose` (fails in both `./main` and this branch: `tests/unit/issues/due-date-timezone-inconsistency.test.ts`)
- `npm run test:integration`
- `npm run test:performance` (pass: no tests found)
- `npm run build` (warning: missing `GOOGLE_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_ID`)
- `npm run test:build`
- Manual: verified sticky headers in Obsidian after force reload

# Pull requests

## Open

Published PRs from `preq/`.

## Closed
