import test from "node:test";
import assert from "node:assert/strict";
import { assertPluralContract } from "../../scripts/lib/plural-contracts.mjs";

const en = "{count, plural, one {# task} other {# tasks}}";
const ru = "{count, plural, one {# задача} few {# задачи} many {# задач} other {# задачи}}";
test("rejects Russian one/other even when ICU compiles", () => {
  assert.throws(() => assertPluralContract(en, "{count, plural, one {# задача} other {# задачи}}", "ru"), /missing CLDR plural category (few|many)/);
  assert.doesNotThrow(() => assertPluralContract(en, ru, "ru"));
});
test("rejects copied English arms, including extra-category padding and nested plurals", () => {
  assert.throws(() => assertPluralContract(en, "{count, plural, other {# tasks}}", "ja"), /English plural arm/);
  assert.throws(() => assertPluralContract(en, "{count, plural, one {# task} few {# tasks} many {# tasks} other {# tasks}}", "ru"), /English plural arm/);
  assert.throws(() => assertPluralContract(`{kind, select, a {${en}} other {none}}`, `{kind, select, a {{count, plural, other {# tasks}}} other {なし}}`, "ja"), /English plural arm/);
});
test("million-only categories are optional; integer-reachable ordinal categories are required", () => {
  for (const [locale, target] of [
    ["fr", "{count, plural, one {# tâche} other {# tâches}}"],
    ["es", "{count, plural, one {# tarea} other {# tareas}}"],
    ["pt", "{count, plural, one {# tarefa} other {# tarefas}}"],
  ]) assert.doesNotThrow(() => assertPluralContract(en, target, locale));
  assert.throws(() => assertPluralContract("{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}", "{n, selectordinal, other {#th}}", "en"), /missing CLDR selectordinal/);
});
test("French and pt-BR exact zero AND one exhaust one; =1 alone does not", () => {
  for (const locale of ["fr", "pt"]) {
    assert.doesNotThrow(() => assertPluralContract(en, "{count, plural, =0 {zéro} =1 {unique} other {plusieurs}}", locale));
    assert.throws(() => assertPluralContract(en, "{count, plural, =1 {unique} other {plusieurs}}", locale), /category one/);
    assert.throws(() => assertPluralContract(en, "{count, plural, =0 {zéro} other {plusieurs}}", locale), /category one/);
  }
});
test("exact arms exhaust Russian one only when they include every integer representative through 999", () => {
  const rules = new Intl.PluralRules("ru");
  const exact = Array.from({ length: 1000 }, (_, count) => count).filter(count => rules.select(count) === "one");
  const target = counts => "{count, plural, " + counts.map(count => `=${count} {контекст}`).join(" ") + " few {контекста} many {контекстов} other {контекста}}";
  assert.doesNotThrow(() => assertPluralContract(en, target(exact), "ru"));
  assert.throws(() => assertPluralContract(en, target(exact.filter(count => count !== 991)), "ru"), /category one/);
});
test("offset selects count minus offset, while exact cases still match original counts", () => {
  const source = "{count, plural, offset:1 one {# item} other {# items}}";
  const target = "{count, plural, offset:1 =0 {zéro} =1 {unique} =2 {deux} other {plusieurs}}";
  assert.doesNotThrow(() => assertPluralContract(source, target, "fr"));
  assert.throws(() => assertPluralContract(source, target.replace("=2 {deux} ", ""), "fr"), /category one/);
  assert.throws(() => assertPluralContract(source, target.replace("=0 {zéro} ", ""), "fr"), /category one/);
});
test("integer coverage applies to plurals nested inside selects", () => {
  const source = `{kind, select, task {${en}} other {none}}`;
  assert.doesNotThrow(() => assertPluralContract(source, "{kind, select, task {{count, plural, =0 {aucune} =1 {unique} other {plusieurs}}} other {aucune}}", "fr"));
  assert.throws(() => assertPluralContract(source, "{kind, select, task {{count, plural, =1 {unique} other {plusieurs}}} other {aucune}}", "fr"), /category one/);
});
test("exact =1 covers English singleton but not Russian 21 or ordinals", () => {
  assert.doesNotThrow(() => assertPluralContract(en, "{count, plural, =1 {one item} other {many items}}", "en"));
  assert.throws(() => assertPluralContract(en, "{count, plural, =1 {задача} few {задачи} many {задач} other {задачи}}", "ru"), /category one/);
  assert.throws(() => assertPluralContract(en, "{count, selectordinal, =1 {first} two {second} few {third} other {last}}", "en"), /category one/);
});
test("ignores interpolation-only and numeric arms, but identical words require exact scoped reasons", () => {
  const source = "{count, plural, one {{title} (1)} other {{title} (2+)}}";
  assert.doesNotThrow(() => assertPluralContract(source, "{count, plural, other {{title} (2+)}}", "ja"));
  const notes = "{count, plural, one {# note} other {# notes} many {# notes}}";
  assert.throws(() => assertPluralContract(notes, notes, "fr", "notes"), /English plural arm/);
  const policy = { fr: { notes: { "count:one": "French note", "count:other": "French notes", "count:many": "French notes" } } };
  assert.doesNotThrow(() => assertPluralContract(notes, notes, "fr", "notes", policy));
  assert.throws(() => assertPluralContract(notes, notes, "fr", "different-id", policy), /English plural arm/);
});
