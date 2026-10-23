import assert from "node:assert/strict";
import test from "node:test";
import { importTranslation, toICU, mapping } from "../../scripts/convert-lingui.mjs";
import { technicalDataConcepts } from "../../scripts/lib/lingui-retired.mjs";

test("technical identifier/path examples never re-enter the message mapping", () => {
  const legacy = Object.fromEntries([...technicalDataConcepts].map(key => [key, "technical example"]));
  legacy["settings.taskProperties.taskPriorities.placeholders.label"] = "High priority";
  assert.deepEqual(Object.keys(mapping(legacy)), ["settings.taskProperties.taskPriorities.placeholders.label"]);
});

test("repeat import preserves authored ICU, including apostrophes and nested arguments", () => {
  const authored = "{count, plural, one {Don't reset ''this''} other {{count, number} items}}";
  for (let run = 0; run < 3; run++) assert.equal(importTranslation("fr", authored, "obsolete input"), authored);
});
test("explicit reviewer refresh imports the reviewed value exactly once", () => {
  const reviewed = "Don't reset {count}";
  const imported = importTranslation("fr", "old authored entry", reviewed, { refreshReviewed: true });
  assert.equal(imported, toICU(reviewed));
  assert.equal(importTranslation("fr", imported, reviewed), imported);
});
test("plural migration input is already ICU and must not be escaped", () => {
  const reviewed = "{count, plural, one {# item} other {# items}}";
  assert.equal(importTranslation("ru", undefined, reviewed, { plural: true }), reviewed);
});
test("whole-message replacements never copy translations of obsolete fragments", () => {
  assert.equal(importTranslation("ja", undefined, "obsolete fragment", { replacement: "Whole source message" }), "");
  assert.equal(importTranslation("ja", "authored whole message", "fragment", { replacement: "Whole source message", refreshReviewed: true }), "authored whole message");
  assert.equal(importTranslation("en", undefined, "fragment", { replacement: "Whole source message" }), "Whole source message");
});
