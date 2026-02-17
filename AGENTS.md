# TaskNotes - Agent Development Guide

This is an Obsidian plugin. The plugin ID is `tasknotes`.

## Build & Test

```bash
# Build the plugin and copy files to the vault's plugin directory
npm run build:test

# After building, reload the plugin in the running Obsidian instance
obsidian plugin:reload id=tasknotes
```

Always run both commands after making changes. Obsidian must be running for the CLI to work.

## Useful Obsidian CLI Commands

```bash
# Check for JavaScript errors after reload
obsidian dev:errors

# View console output
obsidian dev:console

# Run JavaScript in the Obsidian context
obsidian dev:eval code="app.vault.getFiles().length"

# Take a screenshot to verify UI changes
obsidian dev:screenshot path=screenshot.png

# Open developer tools
obsidian dev:open
```

## Other Build Commands

```bash
npm test              # Run unit tests (Jest)
npm run lint          # Lint source files
npm run typecheck     # TypeScript type checking only
npm run build         # Production build (without copying to vault)
```

---

When you make changes, update docs/releases/unreleased.md. If your changes are related to a GitHub issue or PR, include acknowledgement of the individual who opened the issue or submitted the PR. Do not update unreleased.md for the addition of tests; unreleased.md is user-facing. 
