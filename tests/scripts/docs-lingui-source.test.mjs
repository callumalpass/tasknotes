import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { setupI18n } from "@lingui/core";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { compiledCatalogue } from "../helpers/compiled-catalogue.mjs";
import { collectSettingControls } from "../../docs-builder/src/generated-pages.js";

function inventory(code, entries) {
  const messages = compiledCatalogue(Object.fromEntries(entries.map(([message, context]) => [generateMessageId(message, context), message])));
  const core = setupI18n({ locale: "en", messages: { en: messages } });
  return collectSettingControls(ts.createSourceFile("fixture.ts", code, ts.ScriptTarget.Latest, true), core);
}

test("documentation renders actual compiled descriptors and protected example values", () => {
  const controls = inventory(`new Setting().setName(plugin.i18n.translate(msg({message: "Template", context: "docs.name"}))).setDesc(plugin.i18n.translate(msg({message: "Use <0>{path}</0>.", context: "docs.desc", values: {path: uiData("Templates/Task.md", "Literal path example")}})));`, [["Template", "docs.name"], ["Use <0>{path}</0>.", "docs.desc"]]);
  assert.deepEqual(controls, [{ name: "Template", description: "Use Templates/Task.md." }]);
});

test("documentation keeps semantic contexts distinct, deduplicates IDs and rejects obsolete keyed calls", () => {
  const controls = inventory(`add({name: uiText(msg({message: "Shared", context: "first"}))}); add({name: uiText(msg({message: "Shared", context: "second"}))}); add({name: uiText(msg({message: "Shared", context: "first"}))}); new Setting().setName(translate("old.key"));`, [["Shared", "first"], ["Shared", "second"]]);
  assert.deepEqual(controls, [{ name: "Shared", description: "" }, { name: "Shared", description: "" }]);
});
