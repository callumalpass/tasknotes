# fix/swimlane-order

## Deterministic swimlane ordering

Swimlane ordering is now deterministic and independent from card sorting. Status/priority swimlanes follow their configured order, other fields sort alphabetically with "None" last. When filters/search are active, empty swimlanes are hidden. Switching between swimlane and non-swimlane boards resets the layout correctly.

Examples (illustrative):

- Status swimlanes follow the custom status order; empty lanes are hidden when filters/search are active
- Context swimlanes are sorted A–Z with "None" at the end

## Changelog

- Sort swimlanes by property semantics instead of task order
- Include empty status/priority swimlanes based on configured options
- Keep "None" swimlane last for free-text fields
- Hide empty swimlanes when filters/search are active
- Reset swimlane layout class when toggling swimlanes or switching boards

## Tests

- `npm run i18n:sync`
- `npm run lint` (warnings only)
- `node generate-release-notes-import.mjs`
- `npm run typecheck`
- `npm run test:ci -- --verbose` (fails: `tests/unit/issues/due-date-timezone-inconsistency.test.ts` — confirmed failing in `upstream/main`)
- `npm run test:integration`
- `npm run test:performance` (no tests found)
- `npm run build` (warning: missing OAuth client IDs)
- `npm run test:build`
