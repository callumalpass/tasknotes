# feat/ui-tweaks

## Task card affordances and visible-property inheritance

This change set refines task card affordances (clear click cues) and ensures subtasks inherit the parent card’s visible properties so metadata stays consistent across levels.

Examples (illustrative):

- Inline task cards show a pointer on the title to clarify clickability.
- Project cards keep the chevron visible when it appears on the right.
- Subtasks mirror the parent card’s visible properties.

## Changelog

- Add pointer cursor cues to clickable task card controls and inline titles.
- Mark project task cards and keep right-side chevrons visible.
- Persist resolved visible properties on cards and apply them to subtask rendering.
- Respect an explicitly empty visible-properties list (do not fall back to defaults).

## Tests

- `npm run i18n:sync`
- `npm run lint` (warnings only; matches `upstream/main`)
- `node generate-release-notes-import.mjs`
- `npm run typecheck`
- `npm run test:ci -- --verbose` (fails in `upstream/main`: `tests/unit/issues/due-date-timezone-inconsistency.test.ts`)
- `npm run test:integration`
- `npm run test:performance` (no tests found)
- `npm run build` (missing OAuth IDs: `GOOGLE_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_ID`)
- `npm run test:build`
