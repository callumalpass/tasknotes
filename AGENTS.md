# TaskNotes - Agent Development Guide

This is an Obsidian plugin. The plugin ID is `tasknotes`.

## Build & Test

Test using Playwright/CDP against an isolated Obsidian instance: a separate `--user-data-dir` profile and test vault, never the user's normal instance. Use `e2e/obsidian.ts`, which launches an isolated instance by default and verifies the vault path. Do not enable instance reuse; concurrent sessions need separate profiles, vaults, and debug ports.

```bash
npm run e2e:setup # One-time setup
OBSIDIAN_PLUGIN_PATH="$PWD/tasknotes-e2e-vault/.obsidian/plugins/tasknotes" npm run build:test
TASKNOTES_E2E_REUSE_OBSIDIAN=0 npm run e2e -- e2e/tasknotes.spec.ts
```

After changes, rebuild and restart or reload the plugin in the isolated instance. For ad hoc testing, explicitly target your test vault with `OBSIDIAN_PLUGIN_PATH`, verify its path over CDP, and clean up only your own instance.

## Other Build Commands

```bash
npm test              # Run unit tests (Jest)
npm run lint          # Lint source files
npm run typecheck     # TypeScript type checking only
npm run build         # Production build (without copying to vault)
```

Ensure all code changes pass linting checks. Do not weaken linting rules in order to get changes to pass. 

---

When you make changes, update docs/releases/unreleased.md. If your changes are related to a GitHub issue or PR, include acknowledgement of the individual who opened the issue or submitted the PR. Do not update unreleased.md for the addition of tests; unreleased.md is user-facing. 

You may update `.ops/` files locally as you work on items, but do not commit `.ops/` files. `.ops/` is local-only working state.

## Investigating issues

Reproduce issues in an isolated Obsidian instance first. If you have a theory about the cause, test it.

Not all reported issues will require changes to the code, and not all feature requests need to be implemented; Bases are very powerful, but can be difficult to navigate. If something is not working, or is being asked for, figure out if it is--or can be--achieved through Bases first.

## Prepare for a release. 

When asked to prepare for a release: 

1. Run through the @I18N_GUIDE.md and make sure translations are up-to-date (and in their target language--not English placeholders). 
2. Make sure ALL `npm run test` tests are passing. 
3. Make sure there are no linting errors.
4. Make sure all items in @docs/releases/unreleased.md thank the correct issue/pr opener (double check), as well as those who have commented on the issue/pr. Make sure the copy is appropriate--it is user facing so it should not be overly technical. Make sure it is free from anything that resembles marketing copy. do not thank callumalpass 
5. Update `.ops` draft comments and matching Pickle requests for issues addressed in release notes but not yet closed. Start from the release notes, inspect each issue/comment thread individually, make sure `draft_issue_comment` and `draft_close_reason` are appropriate, create/update/cancel closeout Pickle requests as needed, and validate both `.ops` and `.ops/_pickle`. Do not commit `.ops/` files.
6. Move the body of unreleased.md to <VERSION NUMBER>.md, following the pattern of previous releases. Leave the comments that explain unreleased.md inside unreleased.md.
7. Update @manifest.json and @package.json.
8. Commit changes as "release <VERSION NUMBER>" (you can choose the version number unless it is specified).
9. Tag the commit. (Just version number, no 'v' prefix.)
