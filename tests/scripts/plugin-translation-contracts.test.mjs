import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatter } from "@lingui/format-po";
import { locales } from "@mdbase-dev/i18n/config";

// Pinned kit validator, exercised per entry so a review sees every contract
// failure rather than repeatedly stopping at the first locale/message.
const { assertCompleteCatalogue } = await import(new URL("../../node_modules/@mdbase-dev/i18n/scripts/checks.mjs", import.meta.url));
const root = new URL("../../", import.meta.url);

test("all nine authored catalogues preserve generated IDs, completeness and ICU contracts before fallback", async () => {
  const policy = JSON.parse(await readFile(new URL("i18n-policy.json", root), "utf8"));
  const catalogues = Object.fromEntries(await Promise.all(locales.map(async locale => [locale,
    await formatter({}).parse(await readFile(new URL(`src/i18n/locales/${locale}/messages.po`, root), "utf8"), { locale }),
  ])));
  const english = catalogues.en;
  const failures = [];
  for (const locale of locales) {
    assert.deepEqual(Object.keys(catalogues[locale]).sort(), Object.keys(english).sort(), locale);
    for (const [id, entry] of Object.entries(catalogues[locale])) {
      try { assertCompleteCatalogue({ [id]: english[id] }, { [id]: entry }, locale, policy.allowIdentical?.[locale]); }
      catch (error) { failures.push({ locale, id, context: entry.context, source: entry.message, target: entry.translation, problem: error.message }); }
    }
  }
  assert.deepEqual(failures, []);
});
