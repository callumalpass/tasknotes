import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

test("the 22 rewritten one arms have contextual singular wording; all 90 copied es/fr many arms are absent", async () => {
  const ledger = JSON.parse(await readFile(new URL("docs/development/i18n-review-followup.json", root), "utf8"));
  const expected = {
    fr: {
      fuX_1m: "Contexte", "fJ_I-J": "Projet",
      "7PuX6r": "Avec un intervalle de <n> mois, le dernier lundi",
      Y071tE: "Intervalle de <n> jour", "01y_eC": "Intervalle de <n> mois, le 24",
      ciO00S: "Intervalle de <n> mois", "f3a3-d": "Intervalle de <n> semaine, les jours suivants : lundi",
      HI4G2n: "Intervalle de <n> semaine", qqgQnq: "Intervalle de <n> an, le date_fixture", m2FqzW: "Intervalle de <n> an",
    },
    pt: {
      fuX_1m: "Contexto", "fJ_I-J": "Projeto",
      "7PuX6r": "A cada <n> mês na última segunda-feira",
      Y071tE: "A cada <n> dia", "01y_eC": "A cada <n> mês, no dia 24",
      ciO00S: "A cada <n> mês", "f3a3-d": "A cada <n> semana: lundi",
      HI4G2n: "A cada <n> semana", qqgQnq: "A cada <n> ano, em date_fixture", m2FqzW: "A cada <n> ano",
    },
    ru: { fuX_1m: "Не один контекст", "fJ_I-J": "Не один проект" },
  };
  const report = { operands: [0, 1, 2, 5, 21, 1000000], rewrittenOneArms: 0, removedManyArms: 0, rows: [] };
  function choices(tokens) {
    return tokens.flatMap(token => token.cases ? [token, ...token.cases.flatMap(arm => choices(arm.tokens))] : []);
  }
  for (const locale of ["es", "fr", "pt", "ru"]) {
    const catalogue = await formatter({}).parse(await readFile(new URL(`src/i18n/locales/${locale}/messages.po`, root), "utf8"), { locale });
    const core = setupI18n({ locale, messages: { [locale]: compiledCatalogue(Object.fromEntries(Object.entries(catalogue).map(([id, entry]) => [id, entry.translation]))) } });
    for (const item of ledger.retainedAuthoredChanges.filter(item => item.locale === locale && (item.addedArms || item.removedArms))) {
      const entry = catalogue[item.id], ast = parse(entry.translation), selectors = choices(ast);
      for (const arm of item.removedArms ?? []) {
        assert.ok(!selectors.some(token => token.arg === arm.arg && token.cases.some(candidate => candidate.key === arm.category)), `${locale} ${item.id}: optional many retained`);
        report.removedManyArms++;
      }
      for (const arm of item.addedArms ?? []) {
        assert.equal(arm.category, "one");
        assert.equal(arm.copiedFrom, undefined);
        const actual = selectors.find(token => token.arg === arm.arg).cases.find(candidate => candidate.key === "one");
        const start = actual.ctx.offset + actual.ctx.text.length;
        assert.equal(entry.translation.slice(start, start + arm.authoredText.length), arm.authoredText);
        // Exercise even exact-arm-shadowed one branches, without altering the PO.
        const text = `{${arm.arg}, plural, one {${arm.authoredText}} other {${arm.authoredText}}}`;
        const branch = setupI18n({ locale, messages: { [locale]: compiledCatalogue({ branch: text }) } });
        for (const count of locale === "ru" ? [21, 31, 101] : [0, 1]) {
          const values = { ...operands(parse(text), count), weekday: "MO", position: "last", index: 1, day: 24, days: "lundi", date: "date_fixture" };
          assert.equal(branch._("branch", values), expected[locale][item.id].replace("<n>", new Intl.NumberFormat(locale).format(count)), `${locale} ${item.id}: one count=${count}`);
        }
        report.rewrittenOneArms++;
      }
      const renders = report.operands.map(count => ({ count, text: core._(item.id, { ...operands(ast, count), weekday: "MO", position: "last", index: 1, day: 24, days: "lundi", date: "date_fixture" }) }));
      assert.ok(renders.every(row => typeof row.text === "string" && row.text.length > 0));
      report.rows.push({ locale, id: item.id, context: entry.context, renders });
    }
  }
  assert.equal(report.rewrittenOneArms, 22);
  assert.equal(report.removedManyArms, 90);
  await mkdir(new URL("dist/", root), { recursive: true });
  await writeFile(new URL("dist/i18n-plural-followup-render-proof.json", root), JSON.stringify(report, null, 2) + "\n");
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
