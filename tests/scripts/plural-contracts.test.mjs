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
test("requires CLDR ordinal and million-count categories", () => {
  assert.throws(() => assertPluralContract(en, "{count, plural, one {# tâche} other {# tâches}}", "fr"), /category many/);
  assert.throws(() => assertPluralContract("{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}", "{n, selectordinal, other {#th}}", "en"), /missing CLDR selectordinal/);
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
