# Translation workflow

TaskNotes UI uses the shared Lingui kit with synchronous English and nine supported locales: en, de, es, fr, ja, ko, pt, ru and zh. UI language selection is separate from the natural-language parsing configuration in `src/locales/`; do not migrate or rewrite that data when translating interface copy.

## Sources and generated data

- `src/i18n/locales/<locale>/messages.po`: authored interface catalogues.
- `lingui.config.mjs`: extraction and compilation configuration.
- `i18n-policy.json`: exact, reviewed exceptions for legitimate English-identical terms, not a completeness bypass.
- `src/i18n/I18nService.ts`: an isolated Lingui core per service, negotiation and locale-change events.
- `src/i18n/bundledResources.ts`: all nine ordinary bundled catalogues.
- `scripts/export-language-packs.mjs`: deterministic compiled-ICU pack export.

Generated `messages.json` files are ignored and must not be edited. Ordinary tests, compilation, documentation and production builds prepare them through strict gates. The old `src/i18n/resources/*.ts` files are trusted migration inputs only, not runtime resources or the authoring destination. Ordinary conversion preserves authored PO ICU; `--refresh-reviewed` deliberately replaces it and is not a routine integration command.

## Changing interface copy

Use Node 22.22 or newer, install with `npm ci`, and initialize the documentation submodule with `git submodule update --init --checkout docs/spec`. This remains an npm project; machine-local remote-builder bridges are not project package-manager configuration.

1. Mark concise English copy with a Lingui descriptor and meaningful semantic context.
2. Run `npm run i18n:extract` for normal clean extraction. Generated IDs follow the English source and context; never invent IDs or edit compiled JSON.
3. Author every affected target entry in the PO files. Leave unauthored targets empty; never pad them with English. Integrate other translators' POs, then extract normally to retire obsolete IDs.
4. Run `npm run i18n:check`, `npm run test:translation-contracts`, and the relevant tests. The check verifies extraction sync, authored completeness **before fallback**, ICU contracts, identical-term policy and both source guards, then compiles.

Lingui `--strict` alone permits fallback-filled entries and is not authored-completeness acceptance. `npm run i18n:compile`, ordinary `npm test`, CI, production builds and pack export use the full strict gate. `npm run test:dev` and development watch are explicitly labelled fallback workflows, never release acceptance. `npm run test:fresh-catalogues` verifies absent-generated-file typechecking, ordinary strict Jest preparation and standalone documentation regeneration.

## Descriptors and ICU

```ts
import { msg } from "@lingui/core/macro";

button.setText(plugin.i18n.translate(msg({
    message: "Create task",
    context: "Task creation button",
})));

const summary = plugin.i18n.translate(msg({
    message: "{count, plural, one {{count, number} task} other {{count, number} tasks}}",
    context: "Task selection count",
}), { count });
```

Do not use keyed strings, `resolveKey`, plural suffix concatenation, generated-ID literals or translator-call casts. Direct macros own descriptors; only proven finite selections belong in the typed finite registry. Store descriptors if useful, but translate at rendering time rather than capturing a module-time string. Refresh visible labels when the locale changes.

Use whole messages, explicit number/date formatting and real plural/ordinal/select arms. Preserve placeholder names and roles, fixed select keys, exact-number arms, offsets, numeric rich tags and bound pound markers. Locale-specific grammatical categories may differ. A semantic singleton shortcut must use `=1`, not grammatical `one`: Russian 21 is grammatically `one` but is not a single selected context or a daily interval.

## Data and presentation boundaries

Keep Lucide icon identifiers, persisted status/property IDs, literal path/filename/URL examples, protocol syntax and user-authored data stable. Reviewed callers may use `uiData(value, specificRationale)`; it is not a generic-renderer exemption for English labels. Template-path examples are placeholders, not translated stored defaults. Adjacent human labels and explanations remain translated.

Use locale-aware presentation helpers for numbers, durations and displayed dates. Preserve filename/template dates, native Bases syntax, RRULE data and persistence contracts. Whole-message rich text uses fixed numeric structural tags; user values cannot inject formatting. Translate audited diagnostics only at presentation boundaries, leaving raw throws, logs and API/wire values intact.

## UI language and delivery

The picker is under **Settings → TaskNotes → General → Interface language**. System selection follows the host locale, with English fallback when unsupported. Existing stored paths, user labels and user-authored Bases files are not rewritten when the UI language changes.

Ordinary builds synchronously bundle all nine catalogues using compacted data modules. Explicit `TASKNOTES_LANGUAGE_PACK_BASE_URL` builds include English only and pin immutable `tasknotes-lingui-v1` JSON packs; obsolete flat-string packs are incompatible. Export requires exactly all nine complete catalogues. Adding a new language requires coordinated shared-kit locale/CLDR configuration, runtime registry, schema/export, policy and test updates, not just another resource file.

See [Downloadable language packs](language-packs.md) for validation, isolated native acceptance, caching, failure/retry semantics and separately authorized publication. Builds and tests do not authorize publication, deployment, tags or releases.
