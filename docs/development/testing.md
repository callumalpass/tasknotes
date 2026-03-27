# Building and Testing

This page covers build commands, test runners, end-to-end testing, and test data generation. For contributor onboarding, see [Contributing](../contributing.md).

## Build Commands

```bash
bun run dev          # Watch mode (CSS + esbuild, rebuilds on change)
bun run build        # Production build (CSS + type-check + esbuild)
bun run build-css    # Rebuild CSS only
```

## Running Tests

```bash
bun test             # Run all Jest tests
bun run test:watch   # Watch mode
bun run test:unit    # Unit tests only
bun run test:integration   # Integration tests only
```

## End-to-End Tests

TaskNotes has a Playwright test suite that connects to a running Obsidian instance via Chrome DevTools Protocol. E2E tests use a separate vault (`tasknotes-e2e-vault/`) to avoid interfering with your dev vault.

```bash
bun run e2e:setup    # First-time setup (Linux/WSL)
bun run build:test   # Build and copy to e2e vault
bun run e2e          # Run the full test suite
```

On Windows and macOS, setup auto-detects the Obsidian installation. On Linux/WSL, the setup script extracts the Obsidian AppImage.

## Test Data

A test data generator populates the dev vault with realistic content: person notes, group notes, document notes, task notes, and demo `.base` views. Run it after cloning to get a working dev vault, or any time you need to reset to a clean state.

### Test Fixtures Plugin (recommended)

Install the [TaskNotes Test Fixtures](https://github.com/cybersader/tasknotes-test-fixtures) plugin via [BRAT](https://github.com/TfTHacker/obsidian42-brat) (`cybersader/tasknotes-test-fixtures`). It provides test data through Obsidian commands -- no terminal needed, works on mobile too.

| Command | Description |
|---------|-------------|
| Full test setup (configure + generate) | Backs up settings, configures TaskNotes, syncs all fixtures |
| Generate all test data | Creates/updates files, skipping unchanged ones |
| Sync test data | Writes changed files + removes stale files not in fixture set |
| Remove all generated test data | Deletes all generated files without regenerating |
| Configure TaskNotes settings for test data | Backs up current settings, applies test-friendly config |
| Restore TaskNotes settings from backup | Restores your original TaskNotes settings |

The plugin reads TaskNotes settings at generation time so property names in fixtures match your configuration. "Full test setup" goes further -- it configures TaskNotes settings to match the fixture data, giving you a working test environment in one step.

> **Tip:** You can also [clone the test fixtures repo](https://github.com/cybersader/tasknotes-test-fixtures) into `.obsidian/plugins/` and modify it directly. Edit `src/main.ts` to add new data shapes or custom commands for specific testing scenarios.

Generated files appear at:

| Location | Content |
|----------|---------|
| `TaskNotes/Tasks/` | 50 task notes |
| `TaskNotes/Demos/` | 19 demo `.base` views |
| `User-DB/People/` | 7 person notes |
| `User-DB/Groups/` | 5 group notes |
| `Document Library, Knowledge/` | 43 documents across 10 subdirectories |

### Node Script (alternative)

```bash
node scripts/generate-test-data.mjs          # Generate all test data
node scripts/generate-test-data.mjs --clean  # Full reset -- delete then regenerate
```

The `--clean` flag removes all files in `User-DB/People/`, `User-DB/Groups/`, `TaskNotes/Tasks/`, and the 10 subdirectories under `Document Library, Knowledge/`. It does not touch your own files at the root of `Document Library, Knowledge/` or the `.base` files in `TaskNotes/Demos/` and `TaskNotes/Views/`.
