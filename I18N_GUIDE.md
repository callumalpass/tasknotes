# Translation development

The authoritative catalogues are `src/i18n/locales/*/messages.po`. The legacy
keyed resources, state manifests and one-shot migration tools have been retired.
See [the translation guide](docs/development/translations.md) for the current
Lingui workflow, translation policy and review requirements.

- `npm run i18n:extract` explicitly updates and cleans PO entries.
- `npm run i18n:check` requires authored completeness **before fallback**, source
  synchronization, plugin-local CLDR/English-arm checks and UI source guards.
- Ordinary tests, documentation, production builds and pack exports use that same
  strict preparation. Use `rpnpm` for finite builder-backed validation.
- `npm run test:dev` is explicitly development-only fallback, never acceptance.

Persisted identifiers, paths, templates, schema files and user-configured labels
are data. Translate presentation at the display boundary, never keys or stored
values. Preserve authored translations when updating sources; do not replace
missing target text with English.

Historical migration ledgers are under `docs/development/i18n-migration/` and are
not runtime inputs or current acceptance evidence. Git history at `797ebe3a`
retains the original converter and reviewed legacy inputs.
