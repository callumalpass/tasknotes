# Translation Workflow

TaskNotes ships with a lightweight i18n system that keeps interface copy separate from natural-language parsing patterns. Follow this guide to add or update translations.

## Folder Structure

- `src/i18n/resources/en.ts` – English source strings (authoritative key set)
- `src/i18n/resources/<lang>.ts` – One file per locale exporting the same key tree
- `src/i18n/I18nService.ts` – Runtime that loads resources, handles fallbacks, and emits locale-change events

## Adding a New Language

1. Duplicate `src/i18n/resources/en.ts` to a new file with the ISO language code, e.g. `de.ts`.
2. Translate only the string values. Keep keys identical so TypeScript’s type-checking continues to work.
3. Import the new resource in `src/i18n/index.ts` and add it to `translationResources`.
4. (Optional) Add a human-readable label under `common.languages.<code>` so the language shows up nicely in the UI picker.
5. Run `npm run test:unit -- --runTestsByPath tests/unit/services/i18nService.test.ts` to verify lookups and fallbacks.

## Using Translations in Code

```ts
import type { TranslationKey } from 'src/i18n';

const t = (key: TranslationKey) => plugin.i18n.translate(key);
button.setText(t('settings.features.uiLanguage.dropdown.name'));
```

- Always prefer translation keys over inline strings for user-facing copy.
- When dynamic parts are needed, use placeholders (`{count}`) and supply them via `plugin.i18n.translate(key, { count })`.
- Use `plugin.i18n.resolveKey('common.languages.fr')` if you need the raw translated string without interpolation.

## UI Language Picker

Users can switch the interface language under **Settings → Features → Interface Language**. Choosing “System default” tracks the OS/browser locale and falls back to English if unsupported.

## Best Practices

- Keep English strings concise; translators use them as context.
- Update both English and new locale files in the same pull request so CI stays green.
- If a string is reused in multiple places, create a single translation key instead of duplicating text in code.
- When adding new UI, wire translations before merging to avoid regressions for non-English users.

## Future Enhancements

- Automate translation key extraction.
- Integrate a community translation platform once more locales arrive.
- Expand test coverage to snapshot key workflows in multiple languages.
