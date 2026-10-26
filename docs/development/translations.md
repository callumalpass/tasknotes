# Translation workflow

TaskNotes UI uses the shared Lingui kit with synchronous English and ten supported locales: en, de, es, fr, it, ja, ko, pt, ru and zh. UI language selection is separate from the natural-language parsing configuration in `src/locales/`; do not migrate or rewrite that data when translating interface copy.

## Sources and generated data

- `src/i18n/locales/<locale>/messages.po`: authored interface catalogues.
- `lingui.config.mjs`: extraction and compilation configuration.
- `i18n-policy.json`: exact, reviewed exceptions for legitimate English-identical terms, not a completeness bypass.
- `src/i18n/I18nService.ts`: an isolated Lingui core per service, negotiation and locale-change events.
- `src/i18n/bundledResources.ts`: all ten ordinary bundled catalogues.
- `scripts/export-language-packs.mjs`: deterministic compiled-ICU pack export.

Generated `messages.json` files are ignored and must not be edited. Ordinary tests, compilation, documentation and production builds prepare them through strict gates. The old keyed resources, state manifests and one-shot converters have been removed. Their historical versions remain in Git at `797ebe3a`; migration ledgers live under `docs/development/i18n-migration/`. Do not rerun historical codemods against authored POs.

## Changing interface copy

Use Node 22.22 or newer, install with `npm ci`, and initialize the documentation submodule with `git submodule update --init --checkout docs/spec`. This remains an npm project; machine-local remote-builder bridges are not project package-manager configuration.

1. Mark concise English copy with a Lingui descriptor and meaningful semantic context.
2. Run `npm run i18n:extract` for normal clean extraction. Generated IDs follow the English source and context; never invent IDs or edit compiled JSON.
3. Author every affected target entry in the PO files. Leave unauthored targets empty; never pad them with English. Integrate other translators' POs, then extract normally to retire obsolete IDs.
4. Run `npm run i18n:check`, `npm run test:translation-contracts`, and the relevant tests. The check rejects obsolete PO entries without rewriting them, requires CLDR plural/ordinal categories, detects exact English plural arms, and checks direct static call-site values. It also verifies extraction sync, authored completeness **before fallback**, ICU contracts, identical-term policy and both source guards, then compiles. Forwarded/computed value objects need adapter/runtime tests; exact English-arm detection is not a substitute for linguistic review.

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

Use whole messages, explicit number/date formatting and real plural/ordinal/select arms. Quote literal ICU braces (`'{title}'`, `'{{title}}'`), and pass values using the exact argument names. Million-only cardinal `many` is optional in French, Spanish, Portuguese and Italian; required categories are integer-reachable from 0–999. Italian ordinals require `many` (8/11/80/800) and `other`; use authored wording for every included category. Individually reviewed identical plural arms require a locale/ID/argument/key reason, not a blanket exception. Preserve placeholder names and roles, fixed select keys, exact-number arms, offsets, numeric rich tags and bound pound markers. Locale-specific grammatical categories may differ. A semantic singleton shortcut must use `=1`, not grammatical `one`: Russian 21 is grammatically `one` but is not a single selected context or a daily interval.

## Data and presentation boundaries

Keep Lucide icon identifiers, persisted status/property IDs, literal path/filename/URL examples, protocol syntax and user-authored data stable. Reviewed callers may use `uiData(value, specificRationale)`; it is not a generic-renderer exemption for English labels. Template-path examples are placeholders, not translated stored defaults. Adjacent human labels and explanations remain translated.

Kanban/List identities use the existing stable `None`/`True`/`False` tokens for serialized compatibility. Translate only display labels; never put localized labels into drop plans, frontmatter, collapse keys, neighbour lookup or saved column ordering. Empty Bases wrappers also use the same empty identity. Do not automatically rewrite a user's text that happens to resemble a translated empty label.

Default status/priority labels are writable English data, copied for each settings load. `configLabel()` localizes an untouched seed only when its stable ID, value and exact English label match; customized or already-localized labels pass through unchanged. Rendering never saves translations. Label editors edit the stored value. Editable field/group names are English seeds and remain user configuration, not locale snapshots. MDBASE schemas and their explanatory text are stable English data. NLP empty-title detection uses an empty title at the adapter boundary, never translated UI copy.

Use locale-aware presentation helpers for numbers, durations and displayed dates. Preserve filename/template dates, native Bases syntax, RRULE data and persistence contracts. Whole-message rich text uses fixed numeric structural tags; user values cannot inject formatting. Translate audited diagnostics only at presentation boundaries, leaving raw throws, logs and API/wire values intact.

## UI language and delivery

The picker is under **Settings → TaskNotes → General → Interface language**. System selection follows the host locale, with English fallback when unsupported. Existing stored paths, user labels and user-authored Bases files are not rewritten when the UI language changes.

Ordinary builds synchronously bundle all ten catalogues using compacted data modules. Explicit `TASKNOTES_LANGUAGE_PACK_BASE_URL` builds include English only and pin immutable `tasknotes-lingui-v1` JSON packs; obsolete flat-string packs are incompatible. Export requires exactly all ten complete catalogues. Adding a new language requires coordinated shared-kit locale/CLDR configuration, runtime registry, schema/export, policy and test updates, not just another resource file.

### Italian integration

Italian (`it`, endonym **Italiano**) is the tenth UI locale. Regional system preferences such as `it-IT` and explicit `it_CH` choices normalize to `it`. The ordinary registry includes it synchronously; the downloadable build derives its picker and pinned publication manifest from the same ten-locale kit and emits `it.json`. Neither the pack format nor source-message IDs change.

This branch vendors kit `49bea0aa` (`sha256: 4b08df26d7474b26bd90492a1835716f938488b06a73cd3b55943414bc0cbd82`). The matching shared UI tarball was verified (`sha256: 1230707f2ba9545a041f2a9325ab5e2d25ed001885ebc0369d836e00b19d30f0`), but this Obsidian plugin does not consume `@mdbase-dev/ui` or compose any library catalogues: adding that unused dependency or a `--compose` path would be misleading. The shared strict check still validates composition of all configured plugin catalogue scopes. Replace the vendored kit with its published version at merge time.

The Italian identical-term exceptions cover protected interpolation/template syntax, example paths/IDs, numeric formats, symbols, proper product names and established Italian UI loanwords (File, Frontmatter, Pomodoro, Token, Webhook, Agenda). The expand-control symbol `▶` is preserved verbatim. No English sentences are allowlisted. The single scoped English-arm exception is `FBlWXu` / `noteCount:other`: Italian plural **note** (singular **nota**) legitimately matches English singular **note**. Calendar day/week/year abbreviations, unavailable-value text and the missing-key caption were translated rather than allowlisted. The official Obsidian Italian catalogue calls the core plugin **Base**; interface references use **Base**, including the starter note's enable-plugin instruction.

Italian wording follows the [Obsidian Italian glossary](https://github.com/obsidianmd/obsidian-translations/blob/master/terms.txt) and [interface translation](https://github.com/obsidianmd/obsidian-translations/blob/master/translations/it.txt): *etichetta*, *modello*, *area di lavoro*, *riquadro comandi* and *scorciatoia da tastiera*. TaskNotes uses *attività*, *data pianificata*, *data di scadenza*, *riga*, *blocco temporale*, *registrazione di tempo*, *monitoraggio del tempo* and *sottoscrizione calendario*. Actions use the singular imperative. Short action labels in menus, submenus, commands, buttons, settings and dialog titles omit the article before the direct object, such as *Copia nomi dei file*, *Salva modifiche* and *Mostra attività pianificate*. Complete explanatory sentences retain normal grammar, such as *Elimina l’evento quando elimini l’attività*. Preserve necessary articles in complements (*monitoraggio del tempo*, *vista delle attività*) and before substantivized adjectives (*Crea la successiva dopo il completamento*). Singular or plural follows the action's actual scope rather than the omission of an article.

Kanban swimlanes are called *righe* in Italian. The property selector is labelled *Raggruppa righe per*, with related options *Altezza massima delle righe*, *Nascondi righe vuote* and *Ordine delle righe (avanzato)*. Nominal labels retain articulated prepositions: *Ordine delle colonne (avanzato)* and *Ordine delle righe (avanzato)* use the same grammatical form. Technical keys such as `swimLane` and `swimLaneOrder`, source messages and interpolation arguments remain unchanged.

Determine singular or plural from the interface context rather than the form of an English compound noun. Check agreement with the actual subject, such as *attività*, *nota* or *promemoria*. Prefer neutral noun phrases for dynamic durations or count summaries when a fixed adjective would not agree with every possible value; preserve the existing ICU argument roles.

Use *minicalendario* for the mini calendar, *Luogo* for an event location and *Tempo stimato* for a time estimate. Recurring task instances are *occorrenze*. Completion menu actions use *Completa oggi*, *Completa alla data pianificata* and *Completa alla data di scadenza*; status labels may use *Completata*. Task metadata uses *Scadenza*, *Pianificata*, *Creata* and *Modificata*. Keep external plugin names such as *Periodic Notes* recognizable in setup instructions. The generated Pomodoro count columns use plural labels, while calendar views based on `file.ctime` and `file.mtime` retain *Creato* and *Modificato*.

UI language and NLP language remain independent settings. The existing `it` NLP configuration already handles Italian triggers, recurrence and numeric dates, so no mapping or NLP-file changes are needed. Important pre-existing limitation: `tasknotes-nlp-core@0.1.5` delegates free-text date recognition to `chrono-node`, which has no Italian parser and falls back to English. Thus `entro 25/12/2026` and `ogni giorno` work, but **domani is not recognized**. UI translation does not add new date-parser capabilities. Numeric date ordering follows the existing calendar/browser locale precedence, not UI language. Fixing free-text Italian date recognition belongs upstream, not in a UI-locale mapping. The shared core's NLP preview labels (for example `Due:`) also remain English across locales; this integration does not rewrite that preview API.

`test:i18n-source` exercises real Italian date/number formatters and NLP (no translator/date-parser mocks), CLDR/English-arm rejection and Italian ordinal/million-count Bases serialization. Obsolete-PO rejection explicitly covers Italian. `e2e/lingui-bundled.spec.ts` cold-starts Italian and includes Italian plus existing locale controls for pickers, persisted settings, commands, plurals, visible dates, NLP fill-form, native Kanban drag/creation/order, field labels and data boundaries. Run only against the isolated vault/profile with its own debug port. Native-speaker proofreading remains recommended; mechanical checks are not linguistic certification.

See [Downloadable language packs](language-packs.md) for validation, isolated native acceptance, caching, failure/retry semantics and separately authorized publication. Builds and tests do not authorize publication, deployment, tags or releases.
