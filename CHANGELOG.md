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

### fix/context-group-title

Summary:
- Prevents context group headers from resolving plain strings as file links.

Changes:
- Treat non-link, non-path group titles as plain text.
- Keep file link rendering for explicit wiki/markdown links and path-like values.

Tests:
- `npm run i18n:sync`
- `npm run lint` (warnings only; matches upstream)
- `node generate-release-notes-import.mjs`
- `npm run typecheck`
- `npm run test:ci -- --verbose` (fails: `due-date-timezone-inconsistency.test.ts`, also failing in upstream)
- `npm run test:integration`
- `npm run test:performance`
- `npm run build` (warns about missing OAuth env vars)
- `npm run test:build`

### fix/project-card-refresh

Summary:
- Project cards refresh immediately after subtask edits in the task edit modal.

Changes:
- Invalidate the project index after subtask edits in the task edit modal.
- Emit a task-updated event for the parent task to refresh visible views.

Notes:
- This is a minimal fix and does not address the broader, system-wide refresh architecture (see upstream issue #1423).
- The project index invalidation is global and can be more expensive in large vaults; this is an intentional trade-off for immediate correctness.

Tests:
- `npm run i18n:sync`
- `npm run lint` (warnings only; matches `upstream/main`)
- `node generate-release-notes-import.mjs`
- `npm run typecheck`
- `npm run test:ci -- --verbose` (fails in `upstream/main`: `tests/unit/issues/due-date-timezone-inconsistency.test.ts`)
- `npm run test:integration`
- `npm run test:performance` (no tests found)
- `npm run build` (missing OAuth IDs: `GOOGLE_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_ID`)
- `npm run test:build`

### feat/ui-tweaks

Summary:
- Improves task card affordances and keeps visible properties consistent for subtasks.

Changes:
- Add pointer cursor cues to clickable task card controls and inline titles.
- Mark project task cards and keep right-side chevrons visible.
- Persist resolved visible properties on cards and apply them to subtask rendering.
- Respect an explicitly empty visible-properties list (do not fall back to defaults).

Tests:
- `npm run i18n:sync`
- `npm run lint` (warnings only; matches `main`)
- `npm run typecheck`
- `npm run test:ci -- --verbose` (fails: `due-date-timezone-inconsistency` test, same as `main`)
- `./node_modules/.bin/jest tests/unit/ui/TaskCard.test.ts --runInBand`
- `npm run test:integration`
- `npm run test:performance` (no tests found)
- `npm run build` (missing OAuth IDs warning, same as `main`)
- `npm run test:build`

### fix/projects-removal

Summary:
- Removing projects in the edit modal persists to frontmatter, including deletion of the field.

Changes:
- Normalize project link comparisons in the edit modal to handle angle‑bracket markdown links.
- Persist empty project lists by explicitly removing the `projects` field from frontmatter.
- Add a unit test to ensure empty project updates remove the property.

Tests:
- `./node_modules/.bin/jest tests/unit/services/TaskService.test.ts --runInBand`

### fix/angle-brackets

Summary:
- Tightens link parsing and display resolution after the initial angle‑bracket support.

Changes:
- Strip `#heading` / `^block` fragments when resolving link paths.
- Preserve fragments for navigation and hover in `linkRenderer`.
- Resolve project display names using `sourcePath` where available.
- Pass `sourcePath` through stats/filter helpers for consistent relative link handling.

Tests:
- `npm run i18n:sync`
- `npm run lint` (warnings only; matches `main`)
- `node generate-release-notes-import.mjs`
- `npm run typecheck`
- `npm run test:ci -- --verbose` (fails: `due-date-timezone-inconsistency` test, same as `main`)
- `./node_modules/.bin/jest tests/unit/utils/linkUtils.test.ts tests/unit/issues/issue-814-markdown-project-links.test.ts --runInBand`
- `npm run test:integration`
- `npm run test:performance` (no tests found)
- `npm run build` (missing OAuth IDs warning, same as `main`)
- `npm run test:build`

## Closed
