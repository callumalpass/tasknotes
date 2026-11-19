import { readFile } from "node:fs/promises";
import { formatter } from "@lingui/format-po";
import { locales } from "@mdbase-dev/i18n/config";
import { assertPluralContract } from "./lib/plural-contracts.mjs";

const catalogues = {};
for (const locale of locales) {
  const source = await readFile(`src/i18n/locales/${locale}/messages.po`, "utf8");
  // The pinned kit prunes these during check. Reject BEFORE it can rewrite files.
  if (/^\s*#~/m.test(source)) throw new Error(`${locale}: obsolete PO entries; run explicit clean extraction`);
  catalogues[locale] = await formatter({}).parse(source, { locale });
}
const policy = JSON.parse(await readFile("i18n-policy.json", "utf8"));
for (const locale of locales) {
  for (const [id, entry] of Object.entries(catalogues[locale])) {
    const source = catalogues.en[id];
    if (!source || !entry.translation) continue; // Shared strict completeness check reports this.
    assertPluralContract(source.message, entry.translation, locale, id, policy.allowEnglishPluralArms);
  }
}
console.log("PASS plugin CLDR plural categories, exact English-arm detection and clean PO gate");
