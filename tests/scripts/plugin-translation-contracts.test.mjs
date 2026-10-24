import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatter } from "@lingui/format-po";
import { locales } from "@mdbase-dev/i18n/config";
import { setupI18n } from "@lingui/core";
import { createRequire } from "node:module";
import { compiledCatalogue } from "../helpers/compiled-catalogue.mjs";
import { assertPluralContract } from "../../scripts/lib/plural-contracts.mjs";
const requireKit = createRequire(import.meta.resolve("@mdbase-dev/i18n"));
const { parse } = requireKit("@messageformat/parser");

function operands(tokens, count, result = {}) {
  for (const token of tokens) {
    if (token.arg) {
      if (["plural", "selectordinal"].includes(token.type) || token.key === "number") result[token.arg] = count;
      else if (token.key === "date" || token.key === "time") result[token.arg] = new Date("2026-10-24T12:00:00Z");
      else if (!(token.arg in result)) result[token.arg] = `operand_${token.arg}`;
    }
    for (const arm of token.cases ?? []) operands(arm.tokens, count, result);
  }
  return result;
}

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
      try {
        assertCompleteCatalogue({ [id]: english[id] }, { [id]: entry }, locale, policy.allowIdentical?.[locale]);
        assertPluralContract(english[id].message, entry.translation, locale, id, policy.allowEnglishPluralArms);
      }
      catch (error) { failures.push({ locale, id, context: entry.context, source: entry.message, target: entry.translation, problem: error.message }); }
    }
  }
  assert.deepEqual(failures, []);
});

test("every authored PO message compiles and renders real operands, including fractional and million-count plural branches", async () => {
  let renders = 0;
  for (const locale of locales) {
    const catalogue = await formatter({}).parse(await readFile(new URL(`src/i18n/locales/${locale}/messages.po`, root), "utf8"), { locale });
    const messages = compiledCatalogue(Object.fromEntries(Object.entries(catalogue).map(([id, entry]) => [id, entry.translation])));
    const core = setupI18n({ locale, messages: { [locale]: messages } });
    for (const [id, entry] of Object.entries(catalogue)) {
      const ast = parse(entry.translation);
      for (const count of [0, 1, 2, 5, 21, 1.5, 1000000]) {
        assert.equal(typeof core._(id, operands(ast, count)), "string", `${locale} ${id} count=${count}`);
        renders++;
      }
    }
  }
  assert.ok(renders > 170000);
});
