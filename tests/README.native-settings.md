# Native settings verification

The rewrite targets Obsidian 1.13.1+ and is based on TaskNotes 5.0.0-beta.3 (`ef6f3a8f`).

## Automated checks

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
npm run i18n:verify
node scripts/check-docs.mjs
```

`fixtures/native-settings-coverage.json` inventories the 119 scalar `getValue` bindings from the previous General, Appearance, Features, and Integrations tabs. `NativeSettings.test.ts` checks that all remain indexed. Collection-specific tests cover custom properties, form fields, priority triggers, integration updates, safe webhook creation, and Pomodoro storage migration.

`NativeSettings.navigation.test.ts` covers duplicate display names, renaming an open page, and rebinding after external settings reloads. Obsidian 1.13 identifies declarative pages by name rather than stable ID. The guarded adapter in `preservePageNavigation.ts` preserves those paths during renames; remove this internal dependency when Obsidian exposes stable page IDs. Focus restoration is also checked in the live renderer.

## Real Obsidian acceptance test

Use a disposable vault with a name containing `test`, `e2e`, or `smoke`. Back up its plugin files and data before installing the build. Obsidian must be running, with settings configured to open in a popout window.

```sh
OBSIDIAN_PLUGIN_PATH=/absolute/test-vault/.obsidian/plugins/tasknotes npm run build:test
obsidian vault=test plugin:reload id=tasknotes
node scripts/test-native-settings.mjs --vault=test --artifacts=/absolute/artifact-directory
obsidian vault=test dev:errors
```

The script exercises actual settings controls and native search, checks numeric and duplicate-key validation, adds and edits a custom property, changes its type, follows nested pages and keyboard focus, renames a status, checks translations, and reloads the plugin to verify disk persistence. It captures desktop, narrow-screen, mobile-CSS, and light-theme screenshots. Its `finally` block restores the original settings.

The acceptance run was performed on desktop Obsidian 1.13.7. Mobile CSS emulation is not a physical Android/iOS test. OAuth providers, subscription network responses, and webhook delivery are mocked in unit tests; the acceptance script does not connect accounts or send external requests. Existing skipped Jest suites remain skipped.
