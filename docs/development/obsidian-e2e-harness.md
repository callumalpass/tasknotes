# Isolated Obsidian E2E harness

The native Playwright harness launches a separate Obsidian profile and verifies the test vault path before interacting with it. Never enable instance reuse or target your normal vault for tests.

## Update the runtime

```bash
npm run e2e:setup
# Or select an installer explicitly:
npm run e2e:setup -- /path/to/Obsidian.AppImage
```

Setup discovers the highest-version Obsidian AppImage in `~/Applications` or `~/Downloads`. It uses the newest app package by version from the installer or `~/.config/obsidian`, copies that package to `resources/obsidian.asar` (the archive the Electron loader actually reads), and checks it against `manifest.json`'s `minAppVersion`. It does not change the personal Obsidian profile. Extraction bypasses AppImageLauncher desktop integration so it also works headlessly.

Use `OBSIDIAN_APPIMAGE`, `OBSIDIAN_DATA_DIR`, or `OBSIDIAN_ASAR` to override discovery. An explicit `OBSIDIAN_ASAR` selects that exact package, subject to the minimum-version check. A compatible installer works without an existing personal profile.

Setup normally builds the plugin. To refresh only the runtime while keeping an existing bundle, use `TASKNOTES_E2E_SKIP_BUILD=1 npm run e2e:setup`. This does **not** validate current plugin source changes; rebuild separately before testing them.

## Smoke test in a fresh vault and profile

Use separate vaults, profiles, output directories, and debug ports for concurrent sessions:

```bash
run=$(mktemp -d /tmp/tasknotes-e2e.XXXXXX)
cp -aL tasknotes-e2e-vault "$run/vault"

# Build current source into this test vault when testing plugin changes:
OBSIDIAN_PLUGIN_PATH="$run/vault/.obsidian/plugins/tasknotes" npm run build:test

TASKNOTES_E2E_REUSE_OBSIDIAN=0 \
TASKNOTES_E2E_VAULT_DIR="$run/vault" \
TASKNOTES_E2E_USER_DATA_DIR="$run/profile" \
TASKNOTES_E2E_REMOTE_DEBUGGING_PORT=19243 \
npm run e2e -- e2e/obsidian-harness.spec.ts --output="$run/results"
```

The harness logs the actual app-package version and verified vault path. It rejects obsolete versions before waiting for TaskNotes commands and cleans up its owned process group even if startup fails. An occupied CDP port is rejected rather than silently connecting to another session.

Unset `DISPLAY` to use Xvfb. Headless launches explicitly use X11 and disable GPU acceleration. Test profiles disable automatic updates and use `--password-store=basic` to avoid blocking on the desktop keyring. These profiles are only for disposable test data, not personal credentials or OAuth accounts.

Native pointer suites (`drag-round9.spec.ts` and `kanban-redesign.spec.ts`) use
XTest in the test runner itself. Give both the runner and Obsidian the same
owned Xvfb display, large enough for the native window and its screen offset:

```bash
env -u DISPLAY xvfb-run -a -s '-screen 0 2400x1800x24' env \
  TASKNOTES_E2E_REUSE_OBSIDIAN=0 \
  TASKNOTES_E2E_VAULT_DIR="$TEST_VAULT" \
  TASKNOTES_E2E_RUNTIME_DIR="$TEST_RUNTIME" \
  TASKNOTES_E2E_USER_DATA_DIR="$TEST_PROFILE" \
  TASKNOTES_E2E_REMOTE_DEBUGGING_PORT=19245 \
  npm run e2e -- --project=obsidian --workers=1 \
  e2e/drag-round9.spec.ts e2e/kanban-redesign.spec.ts
```

Allocate the vault, copied runtime, profile and port before running this command.
Do not unset `DISPLAY` inside `xvfb-run`: the runner needs that value for XTest.
The default Xvfb screen can clip pointer coordinates even when a CDP screenshot
shows the complete viewport. Do not use the user's desktop display for this lane.

`npm run e2e:launch` also uses an isolated profile for manual setup. It accepts the same vault/profile overrides. `TASKNOTES_E2E_RUNTIME_DIR` overrides the unpacked runtime for both launchers.

Runtime-selection regression tests:

```bash
node --test scripts/e2e-runtime.test.mjs
```
