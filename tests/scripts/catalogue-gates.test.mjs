import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import gates from "../../scripts/lib/catalogue-gates.cjs";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), "tasknotes-catalogue-gates-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, "node_modules/@mdbase-dev/i18n"), { recursive: true });
  await mkdir(resolve(root, "node_modules/@lingui/cli"), { recursive: true });
  await mkdir(resolve(root, "scripts"), { recursive: true });
  await writeFile(resolve(root, "scripts/check-message-values.mjs"), 'import fs from "node:fs"; fs.appendFileSync("calls", JSON.stringify(["message-values"]) + "\\n"); if (fs.existsSync("bad-values")) process.exit(1);');
  await writeFile(resolve(root, "scripts/check-plural-contracts.mjs"), 'import fs from "node:fs"; fs.appendFileSync("calls", JSON.stringify(["plural-contracts"]) + "\\n"); if (fs.existsSync("bad-plurals")) process.exit(1);');
  await writeFile(resolve(root, "node_modules/@mdbase-dev/i18n/package.json"), JSON.stringify({ bin: { "mdbase-i18n": "cli.cjs" } }));
  await writeFile(resolve(root, "node_modules/@lingui/cli/package.json"), JSON.stringify({ main: "api.cjs" }));
  await writeFile(resolve(root, "node_modules/@lingui/cli/api.cjs"), "module.exports = {};");
  const journal = 'const fs = require("node:fs"); fs.appendFileSync("calls", JSON.stringify(process.argv.slice(2)) + "\\n");';
  // Instrumented CLI fixtures test routing/order, not translation correctness.
  await writeFile(resolve(root, "node_modules/@mdbase-dev/i18n/cli.cjs"), journal + 'if (fs.existsSync("incomplete")) process.exit(1); fs.writeFileSync("compiled", "strict");');
  await writeFile(resolve(root, "node_modules/@lingui/cli/lingui.js"), journal + 'fs.writeFileSync("compiled", "development");');
  await writeFile(resolve(root, "scripts/check-obsidian-i18n.mjs"), 'import fs from "node:fs"; fs.appendFileSync("calls", JSON.stringify(["obsidian-source"]) + "\\n"); if (fs.existsSync("bad-ui")) process.exit(1);');
  return { root, calls: async () => (await readFile(resolve(root, "calls"), "utf8")).trim().split("\n").map(line => JSON.parse(line)) };
}

test("strict preparation checks authored completeness before generating fallback data", async t => {
  const { root, calls } = await fixture(t);
  await writeFile(resolve(root, "incomplete"), "yes");
  assert.throws(() => gates.prepareStrictCatalogues(root));
  assert.deepEqual(await calls(), [["plural-contracts"], ["message-values"], ["check"]]);
  await assert.rejects(readFile(resolve(root, "compiled")), { code: "ENOENT" });
});
test("strict preparation also requires the consumer-specific UI source guard", async t => {
  const { root, calls } = await fixture(t);
  gates.prepareStrictCatalogues(root);
  assert.deepEqual(await calls(), [["plural-contracts"], ["message-values"], ["check"], ["obsidian-source"]]);
  assert.equal(await readFile(resolve(root, "compiled"), "utf8"), "strict");
  await writeFile(resolve(root, "bad-ui"), "yes");
  assert.throws(() => gates.prepareStrictCatalogues(root));
});
test("consumer plural rejection happens before the shared kit can compile", async t => {
  const { root, calls } = await fixture(t);
  await writeFile(resolve(root, "bad-plurals"), "yes");
  assert.throws(() => gates.prepareStrictCatalogues(root));
  assert.deepEqual(await calls(), [["plural-contracts"]]);
  await assert.rejects(readFile(resolve(root, "compiled")), { code: "ENOENT" });
});

test("obsolete PO entries fail read-only before the pinned kit can prune them", async t => {
  const root = await mkdtemp(resolve(tmpdir(), "tasknotes-obsolete-po-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = resolve(root, "src/i18n/locales/en");
  await mkdir(dir, { recursive: true });
  const filename = resolve(dir, "messages.po");
  for (const prefix of ["", "\t ", "\uFEFF"]) {
    const source = `msgid "Current"\nmsgstr "Current"\n\n${prefix}#~ msgid "Obsolete"\n${prefix}#~ msgstr "Obsolete"\n`;
    await writeFile(filename, source);
    assert.throws(() => execFileSync(process.execPath, [fileURLToPath(new URL("../../scripts/check-plural-contracts.mjs", import.meta.url))], { cwd: root, stdio: "pipe" }), /obsolete PO entries/);
    assert.equal(await readFile(filename, "utf8"), source);
  }
});

test("only explicit development preparation permits incomplete fallback catalogues", async t => {
  const { root, calls } = await fixture(t);
  await writeFile(resolve(root, "incomplete"), "yes");
  gates.prepareDevelopmentCatalogues(root);
  assert.deepEqual(await calls(), [["compile", "--workers", "1"]]);
  assert.equal(await readFile(resolve(root, "compiled"), "utf8"), "development");
});
test("fresh source typechecks without generated JSON, whose contents stay unknown rather than any", async t => {
  const { root } = await fixture(t);
  const declaration = resolve(root, "catalogue.d.ts");
  await writeFile(declaration, await readFile(new URL("../../src/i18n/compiledCatalogue.d.ts", import.meta.url), "utf8"));
  const entry = resolve(root, "entry.ts");
  await writeFile(entry, 'import catalogue from "./locales/en/messages.json"; const value: unknown = catalogue.messages; const unsafe: string = catalogue.messages;');
  const program = ts.createProgram([entry, declaration], { strict: true, noEmit: true, types: [], resolveJsonModule: true, moduleResolution: ts.ModuleResolutionKind.Node10, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(item => item.code), [2322]);
  assert.match(ts.flattenDiagnosticMessageText(diagnostics[0].messageText, "\n"), /unknown/);
});

test("ordinary Jest/CI configuration stays strict; development is separately named", () => {
  const require = createRequire(import.meta.url);
  assert.notEqual(require("../../jest.config.js").globals?.tasknotesI18nDevelopmentFallback, true);
  assert.equal(require("../../jest.dev.config.cjs").globals.tasknotesI18nDevelopmentFallback, true);
  assert.match(require("../../jest.config.js").globalSetup, /jest-catalogues\.cjs$/);
});
