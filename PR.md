# fix/angle-brackets

## Link Resolution Follow‑ups

Tightens link parsing and display resolution after the [initial angle‑bracket support](https://github.com/callumalpass/tasknotes/pull/1413). Anchors are stripped for file resolution while still preserved for navigation, and relative project links resolve against the source file where possible.

Examples (illustrative):

- `[My Note](Folder/My Note.md#Section)` resolves to `Folder/My Note.md` for lookup, but still opens `#Section`.
- `[[Folder/My Note#Section]]` displays as `My Note` while keeping the fragment for navigation.
- Relative project links display the correct title when resolved from the task's path.

## Changelog

- Strip `#heading` / `^block` fragments when resolving link paths.
- Preserve fragments for navigation and hover in `linkRenderer`.
- Resolve project display names using `sourcePath` where available.
- Pass `sourcePath` through stats/filter helpers for consistent relative link handling.

## Tests

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
