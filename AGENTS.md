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

## Prepare a release — no publication implied

When asked to prepare a release:

1. Use a dedicated release worktree and committed source changes. Preserve unrelated dirty/untracked files and unpushed work in the canonical checkout; never reset, stash or clean them to prepare a release. Do not create a PR.
2. Follow @I18N_GUIDE.md. Translations must be current and in their target languages, not English placeholders.
3. Run ALL tests, strict lint, typecheck, translation verification, documentation checks, production build, bundle/dependency checks and the bundle-size budget. Follow the native Obsidian test procedure after verifying the intended test vault. Report unavailable/manual checks and blockers explicitly; do not weaken checks or claim unrun tests passed.
4. Verify release-note acknowledgements against the individual issue/PR threads, including relevant contributors/commenters. Do not thank callumalpass. Keep notes factual, user-facing and free of marketing copy.
5. Move released entries from unreleased.md into <VERSION NUMBER>.md, following previous releases and retaining the explanatory comments in unreleased.md. Update manifest.json, package.json, package-lock.json, versions.json, release-note imports/index and required documentation. Avoid automatic tagging: use `npm version --no-git-tag-version` or explicit edits, reviewing hook side effects.
6. Commit the prepared changes locally as "release <VERSION NUMBER>". Present the exact version, commit, release notes, validation results and risks. Ask the user directly in the agent conversation whether to publish, then STOP and wait.

Preparation does **not** authorize pushing, tagging, publishing, GitHub comments or issue closure. Do not use Pickle for release or closeout approvals. Keep `.ops/` local-only; linked worktrees must use the canonical collection, not create another one.

## Publish only after explicit approval

Approval applies only to the exact candidate presented above. If the commit, version or notes change, rerun checks and obtain fresh approval. Scheduled prompts, passing tests, silence and approval of an earlier release are not approval.

After approval, recheck candidate identity and repository drift. Preserve dirty work, fast-forward only where safe, and push only the approved commit without force. Create an annotated version tag at that commit (no `v` prefix) and push only that tag. If main advanced, reconcile and ask again rather than silently including more changes or force-pushing.

The tag workflow creates a **draft** GitHub release. Wait for success and verify its exact source commit, artifact attestations/provenance, assets, manifest version, bundle budget and approved notes before publishing it as the latest stable release. Verify publication and report the URL. Inspect uncertain outcomes before retrying any mutation; never overwrite tags or blindly retry a publication.
