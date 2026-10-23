import { formatter } from "@lingui/format-po";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pluralKeys } from "./lib/lingui-plurals.mjs";

const locales = ["en", "de", "es", "fr", "ja", "ko", "pt", "ru", "zh"];
const po = formatter({ origins: true, lineNumbers: false });
const catalogues = {}, hashes = {};
for (const locale of locales) {
  const text = await readFile(`src/i18n/locales/${locale}/messages.po`, "utf8");
  catalogues[locale] = await po.parse(text, { locale });
  hashes[locale] = createHash("sha256").update(text).digest("hex");
}
const map = JSON.parse(await readFile("scripts/plugin-key-map.json", "utf8"));
const english = Object.entries(catalogues.en).filter(([, entry]) => !entry.obsolete);
const reverse = id => Object.entries(map).filter(([, entry]) => entry.id === id).map(([key]) => key);
const pluralOrdinal = english.filter(([, entry]) => /,\s*(?:plural|selectordinal)\s*,/.test(entry.message)).map(([id, entry]) => ({
  id, context: entry.context, message: entry.message,
  legacyConcepts: reverse(id), missingLocales: locales.slice(1).filter(locale => !catalogues[locale][id]?.translation),
})).sort((a, b) => a.id.localeCompare(b.id));
const migratedPluralIds = new Set([...pluralKeys].map(key => map[key]?.id).filter(Boolean));
const japaneseFragmentReview = english.filter(([id]) => migratedPluralIds.has(id)).map(([id, entry]) => ({
  id, context: entry.context, translation: catalogues.ja[id]?.translation,
})).filter(entry => /(?<![\w{])(?:minutes?|hours?|days?|tasks?)(?![\w,}])/.test(entry.translation ?? ""));
const report = {
  branch: "feat/lingui-port", source: "src/i18n/locales/en/messages.po",
  messageCount: english.length, catalogueSha256: hashes,
  perLocale: Object.fromEntries(locales.map(locale => [locale, {
    total: Object.values(catalogues[locale]).filter(entry => !entry.obsolete).length,
    empty: Object.values(catalogues[locale]).filter(entry => !entry.obsolete && !entry.translation).length,
  }])),
  emptyIds: english.filter(([id]) => !catalogues.de[id]?.translation).map(([id]) => id).sort(),
  pluralOrdinal, japaneseFragmentReview,
  notes: [
    "New copy is English-only: author all eight target POs; do not fill with English or copy another locale.",
    "Review migrated plural/ordinal entries even when already nonempty. CLDR categories are locale-specific; preserve argument names and select keys.",
    "Japanese minute/task English fragments inherited from the obsolete suffix contract need proper whole-message translations, not acceptance as identical text.",
    "Monthly weekday recurrence has complete MO..SU select arms so ordinal gender/case can agree; retain last/every/other keys.",
    "Yearly recurrence receives a complete Intl-formatted month/day to preserve contextual month case. Weekly days are an Intl list of standalone weekday names; choose a grammatical whole phrase (e.g. a neutral label).",
    "Preserve numeric rich-text tags, Markdown structure, URLs, protected template/path/code parameters and persisted wire IDs.",
    "Default converter reruns preserve authored PO ICU. Never run --refresh-reviewed after translation integration without explicitly reconciling authored plural fixes.",
  ],
};
for (const locale of locales.slice(1)) {
  const empty = english.filter(([id]) => !catalogues[locale][id]?.translation).map(([id]) => id).sort();
  if (JSON.stringify(empty) !== JSON.stringify(report.emptyIds)) throw new Error(`Different empty-ID set: ${locale}`);
}
await writeFile("docs/development/i18n-translation-handoff.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ messages: report.messageCount, perLocale: report.perLocale, pluralOrdinal: pluralOrdinal.length, japaneseFragmentReview: japaneseFragmentReview.map(({ id, context }) => ({ id, context })) }, null, 2));
