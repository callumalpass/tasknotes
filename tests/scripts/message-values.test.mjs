import test from "node:test";
import assert from "node:assert/strict";
import { inspectMessageValues } from "../../scripts/lib/message-values.mjs";

test("catches both reviewed call-site parameter mismatches", () => {
  for (const [message, provided, missing] of [["Task created: {title}", "taskTitle", "title"], ["Could not resolve: {entries}", "name", "entries"]]) {
    const bad = `translate(msg({ message: ${JSON.stringify(message)} }), { ${provided}: value });`;
    assert.deepEqual(inspectMessageValues(bad).map(finding => finding.missing), [[missing]]);
    assert.deepEqual(inspectMessageValues(bad.replace(`${provided}:`, `${missing}:`)), []);
  }
});
test("literal braces must be quoted, not silently interpreted as missing arguments", () => {
  assert.deepEqual(inspectMessageValues('uiText(msg({ message: "{date}-{title}" }));')[0].missing, ["date", "title"]);
  assert.deepEqual(inspectMessageValues(`uiText(msg({ message: "'{date}'-'{title}'" }));`), []);
  assert.deepEqual(inspectMessageValues(`uiText(msg({ message: "Single-brace syntax like '{title}' and '{{title}}'" }));`), []);
});
test("collects nested plural/select operands and embedded descriptor values", () => {
  const message = "{kind, select, task {{count, plural, one {{title}} other {# tasks}}} other {{name}}}";
  const call = `plugin.i18n.translate(msg({ message: ${JSON.stringify(message)}, values: { kind } }), { count: 2, title, name });`;
  assert.deepEqual(inspectMessageValues(call), []);
  assert.deepEqual(inspectMessageValues(call.replace(", name", ""))[0].missing, ["name"]);
});
test("does not guess computed/forwarded value objects or non-translator calls", () => {
  assert.deepEqual(inspectMessageValues('uiText(msg({ message: "{title}" }), forwarded); uiText(msg({message:"{title}"}), {...values}); other(msg({message:"{title}"}));'), []);
});
