import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { linguiMacros } from "../../scripts/lib/lingui-build.mjs";
import { assertPluralContract } from "../../scripts/lib/plural-contracts.mjs";
import gates from "../../scripts/lib/catalogue-gates.cjs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
gates.prepareStrictCatalogues(root);
const result = await build({
  absWorkingDir: root,
  stdin: {
    contents: `export { setupI18n } from "@lingui/core";
      export { bindUIDisplay, uiText } from "./src/i18n/runtime";
      export { basesMessage } from "./src/i18n/basesMessages";
      export { formatUIDate, formatStableDate, uiNumber } from "./src/i18n/formatters";
      export { NaturalLanguageParser } from "./src/services/NaturalLanguageParser";
      export { getAvailableLanguages } from "./src/locales";`,
    resolveDir: root, loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false,
  plugins: [linguiMacros()],
});
const api = await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64"));
const catalogue = JSON.parse(await readFile(new URL("../../src/i18n/locales/it/messages.json", import.meta.url), "utf8"));
const core = api.setupI18n({ locale: "it", messages: { it: catalogue.messages } });
api.bindUIDisplay(core);

function evaluateBases(id, count) {
  const expression = api.basesMessage({ id }, { count: "count" });
  return new Function("count", "choose", `return ${expression.replaceAll("if(", "choose(")}`)(count, (condition, yes, no) => condition ? yes : no);
}

test("Italian UI dates and numbers localize without changing stable date tokens", () => {
  const date = new Date(2026, 9, 24, 12);
  assert.equal(api.formatUIDate(date, "EEEE d MMMM yyyy"), "sabato 24 ottobre 2026");
  assert.equal(api.formatStableDate(date, "MMMM"), "October");
  assert.equal(api.formatStableDate(date, "yyyy-MM-dd"), "2026-10-24");
  // CLDR grouping thresholds vary between Node and Obsidian's ICU revisions.
  assert.equal(api.uiNumber(12345.5), "12.345,5");
});

test("Italian Bases cardinal and ordinal rules agree with Intl and Lingui", () => {
  // Synthetic compiled messages test each serializer arm, including optional millions.
  core.load("it", {
    cardinal: [["count", "plural", { one: ["uno"], many: ["milioni"], other: ["altri"] }]],
    ordinal: [["count", "selectordinal", { many: ["speciale"], other: ["altro"] }]],
  });
  for (const count of [0, 1, 2, 8, 11, 21, 80, 800, 1000, 1000000, 2000000]) {
    for (const id of ["cardinal", "ordinal"]) assert.equal(evaluateBases(id, count), core._(id, { count }), `${id}: ${count}`);
  }
});

test("Italian strict plural checks reject missing ordinals and copied English prose", () => {
  const source = "{count, plural, one {# task} other {# tasks}}";
  assert.doesNotThrow(() => assertPluralContract(source, "{count, plural, one {# attività} other {# attività}}", "it"));
  assert.throws(() => assertPluralContract(source, "{count, plural, other {# attività}}", "it"), /category one/);
  assert.throws(() => assertPluralContract(source, "{count, plural, one {# task} other {# attività}}", "it"), /English plural arm/);
  assert.throws(() => assertPluralContract("{n, selectordinal, other {#th}}", "{n, selectordinal, other {#°}}", "it"), /category many/);
  assert.doesNotThrow(() => assertPluralContract("{n, selectordinal, other {#th}}", "{n, selectordinal, many {l’#°} other {il #°}}", "it"));
});

test("Italian UI and existing Italian NLP selection coexist without locale remapping", () => {
  assert.deepEqual(api.getAvailableLanguages().find(language => language.value === "it"), { value: "it", label: "Italiano" });
  const plugin = { settings: { customStatuses: [], customPriorities: [], nlpDefaultToScheduled: true, nlpLanguage: "it", calendarViewSettings: { locale: "it-IT" } } };
  const parser = api.NaturalLanguageParser.fromPlugin(plugin);
  const parsed = parser.parseInput("Comprare latte entro 25/12/2026");
  assert.equal(parsed.title, "Comprare latte");
  assert.equal(parsed.dueDate, "2026-12-25");
  assert.equal(parser.parseInput("Comprare latte ogni giorno").recurrence, "FREQ=DAILY");
  // Changing UI does not mutate NLP selection or parsing/persistence semantics.
  core.loadAndActivate({ locale: "en", messages: {} });
  assert.equal(plugin.settings.nlpLanguage, "it");
  assert.equal(parser.parseInput("Comprare latte entro 25/12/2026").dueDate, "2026-12-25");
  // Existing upstream limitation: chrono-node has no Italian parser. Do not
  // silently map it to a different language or claim domani is supported.
  assert.equal(parser.parseInput("Comprare latte domani").scheduledDate, undefined);
  core.loadAndActivate({ locale: "it", messages: catalogue.messages });
});
