# Plugin Lingui translation handoff

Branch: `feat/lingui-port`, draft PR #2418, stacked on `feat/downloadable-language-packs`.

## Integration amendment

The frozen handoff below remains the translator baseline. Twelve technical examples have since been retired from translation: Lucide IDs, persisted identifier examples, concrete template/file paths, a URL and a dummy token. Their exact IDs and reasons are in [the retirement inventory](i18n-retired-data-messages.json). Current English has **2,797 active messages**, with no new messages to author. Drop only those retired IDs when integrating a translator branch; normal clean extraction canonicalizes PO formatting without altering authored translations. Placeholder changes do not alter stored defaults, configured paths or template lookup behavior. The `no-key` missing-state caption remains translatable because it is a UI fallback, not a persisted key.

Ten semantic-one contracts were also corrected without inventing foreign prose: zero/single/multiple classifiers and recurrence shortcuts use exact `=1`, while grammatical Russian `one` remains available for 21/31 in numeric recurrence arms. The [contract inventory](i18n-singleton-contracts.json) records old/new generated IDs and mechanical carry-forward rules. The active count remains 2,797; all nine authored catalogues are complete. The original 44-entry plural handoff is historical; current strict checks cover the replacement IDs too.

## Historical frozen source

Two consecutive clean extractions are byte-identical across all nine POs. There are **2,809 active messages**: English has zero empty entries; **de, es, fr, ja, ko, pt, ru and zh each have 669 empty entries** (5,352 target entries). New target copy is deliberately empty, not English padding.

Author only `src/i18n/locales/<locale>/messages.po`, using the initiative glossary and `burst/reviews/plugin-<locale>.md`. Do not edit compiled JSON, generated IDs, English copy, the old TS inputs, or policy exceptions to conceal missing translations. PO is now authoritative. The default converter preserves authored ICU; `--refresh-reviewed` deliberately reimports legacy reviewer inputs and must not be run after integration without reconciling authored fixes.

The machine-readable [handoff](i18n-translation-handoff.json) contains catalogue SHA-256 values, all 669 empty IDs, and the **44 active plural/ordinal IDs** with complete English text, context, legacy concepts and missing locales. Review those 44 even when their translations are already nonempty. Runtime selection is restricted to 22 proven finite sites / 210 legacy concepts; 471 unused legacy catalogue entries were removed rather than sent for needless translation.

## Grammar and protected data

- Use locale-appropriate CLDR plural/ordinal categories, not English suffix tokens. Preserve argument names, formatting roles and fixed `select` keys. Keep `#` bound to its intended count.
- Monthly weekday recurrence has complete `MO`–`SU` arms so ordinal gender/case can agree. Preserve `last` / `every` / `other` keys. English ordinal categories need not be copied into languages with different CLDR rules.
- Yearly recurrence receives a complete Intl month/day, avoiding uninflected standalone Russian month names. Weekly day lists contain standalone Intl weekday names; choose a grammatical complete phrase rather than requiring unavailable inflection.
- Preserve numeric rich-text tags, Markdown structure and protected URL/path/template/code parameters. OAuth titles/body are text; HTML structure is not translated and all values are escaped.
- Generated `.base` files are creation-time snapshots. Existing user files and user-authored titles, paths, statuses and metadata must not be rewritten on a language switch. Native Bases date-format expressions remain native engine syntax.

### Japanese fragments requiring explicit review

The former suffix contract left English minute/hour/day/task words in these **nonempty** translations. They require proper whole-message Japanese, independently of the 669 empty entries:

| ID | Legacy concept |
| --- | --- |
| `ZwH-HO` | `settings.integrations.timeFormats.minutesAgo` |
| `tzh-2L` | `settings.integrations.timeFormats.hoursAgo` |
| `ZIjHZr` | `settings.integrations.timeFormats.daysAgo` |
| `MjXP8h` | `services.instantTaskConvert.notices.convertingTasks` |
| `1ume_k` | `services.instantTaskConvert.notices.conversionSuccess` |
| `cU-DWO` | `services.instantTaskConvert.notices.partialConversion` |
| `i3yiX0` | `services.calendarExport.notices.downloadSuccess` |

## Evidence and remaining gates

- Typecheck passes. Shared source guard passes across 412 modules; consumer guard passes direct/forwarded UI, interpolation, callbacks, diagnostics, finite selection and eager-module checks.
- Source/converter fixtures: 35 passing tests. Real-catalogue service/presentation suites: 47 passing tests, including all nine compression round trips, Bases versus Lingui counts, Russian/Korean 0/1/2/5/21, ordinal weekdays, contextual month case and HTML/rich-text injection safety.
- [Audit reconciliation](i18n-audit-closure.json) covers 1,075 original rows, including 156 formatting rows, plus 93 forwarded and 23 conditional-key sites. This is source evidence, **not final native acceptance**.
- Strict check remains blocked by missing authored target translations. No non-strict compile is a release gate: temporary JSON compilation supports development only.
- Full Jest fixture migration, lint/docs/pack/tooling gates, final bundled/downloadable budget measurements and isolated native en/ja/de/ru regression remain outstanding. The prior compact bundle measured 4,423,994 bytes against the unchanged `<5,000,000` budget; remeasure after final integration.
- No publication, main writes, releases, R2 operations or subagents.
