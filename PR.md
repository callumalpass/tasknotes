# fix/swimlane-order

## Deterministic swimlane ordering

Swimlane ordering is now deterministic and independent from card sorting. Status/priority swimlanes follow their configured order, other fields sort alphabetically with "None" last.

Examples (illustrative):

- Status swimlanes follow the custom status order, even if empty
- Context swimlanes are sorted A–Z with "None" at the end

## Changelog

- Sort swimlanes by property semantics instead of task order
- Include empty status/priority swimlanes based on configured options
- Keep "None" swimlane last for free-text fields

## Tests

- `npm run i18n:sync`
- `npm run lint` (warnings only)
- `node generate-release-notes-import.mjs`
- `npm run typecheck`
- `npm run test:ci -- --verbose` (fails: `tests/unit/issues/due-date-timezone-inconsistency.test.ts` — needs upstream comparison)
- `npm run test:integration`
- `npm run test:performance` (no tests found)
- `npm run build` (warning: missing OAuth client IDs)
- `npm run test:build`
