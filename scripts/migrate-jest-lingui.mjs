// Migration tooling only: replace keyed test stubs with call-through real catalogue observers.
import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
const log = (await readFile(process.argv[2], "utf8")).replace(/\x1b\[[0-9;]*m/g, "");
const files = [...new Set([...log.matchAll(/^FAIL (tests\/[^\n]+\.ts)$/gm)].map(match => match[1]))];
const map = JSON.parse(await readFile("scripts/plugin-key-map.json", "utf8"));
let prior = [];
try { prior = JSON.parse(await readFile("scripts/plugin-jest-migration.json", "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
const ledger = [];
for (const file of files) {
  if (/languagePack|i18nService|interfaceSurfaces|modalFieldsTranslations/.test(file)) continue;
  const text = await readFile(file, "utf8"), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const edits = []; let changed = false;
  const add = (node, replacement) => { if (node.getText(ast) === replacement) return; edits.push([node.getStart(ast), node.end, replacement]); changed = true; };
  const callable = node => ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isCallExpression(node) && node.expression.getText(ast) === "jest.fn";
  const descriptor = node => ts.isCallExpression(node) && ["msg", "messageForKey"].includes(node.expression.getText(ast));
  const descriptorText = node => node.expression.getText(ast) === "messageForKey" ? `mockConceptDescriptor(${node.arguments.map(arg => arg.getText(ast)).join(", ")})` : node.getText(ast);
  function visit(node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) && node.left.name.text === "translate" && callable(node.right)) {
      add(node.right, "mockObserveTranslation()"); return;
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(ast).replaceAll('"', '').replaceAll("'", '') === "translate" && callable(node.initializer)) {
      add(node.initializer, "mockObserveTranslation()"); return;
    }
    if (ts.isMethodDeclaration(node) && ts.isObjectLiteralExpression(node.parent) && node.name.getText(ast) === "translate") {
      add(node, "translate: mockObserveTranslation()"); return;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "translate" && node.body && node.parameters[0]?.type?.kind === ts.SyntaxKind.StringKeyword) {
      add(node, "function translate(...args: Parameters<typeof mockEnglishText>): string { return mockEnglishText(...args); }"); return;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^(?:mock)?(?:translate|translator)$/i.test(node.name.text) && node.initializer && callable(node.initializer)) {
      add(node, `${node.name.text} = mockObserveTranslation()`); return;
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (["toBe", "toEqual"].includes(method) && node.arguments[0] && descriptor(node.arguments[0])) {
        const receiver = node.expression.expression.getText(ast).replaceAll("messageForKey(", "mockConceptDescriptor(");
        const expected = descriptorText(node.arguments[0]);
        add(node, /\.(?:nameKey|labelKey)\b/.test(receiver) ? `${receiver}.toEqual(${expected})` : `${receiver}.${method}(mockEnglishText(${expected}))`); return;
      }
      if (/^toHaveBeen(?:Last|Nth)?CalledWith$/.test(method) && !/translate/i.test(node.expression.expression.getText(ast))) {
        for (const argument of node.arguments) if (descriptor(argument)) add(argument, `mockEnglishText(${descriptorText(argument)})`);
        if (node.arguments.some(descriptor)) return;
      }
      if (/^toHaveBeen(?:Last|Nth)?CalledWith$/.test(method) && /translate/i.test(node.expression.expression.getText(ast))) {
        const index = method.includes("Nth") ? 1 : 0, argument = node.arguments[index];
        if (argument && ts.isStringLiteral(argument) && Object.hasOwn(map, argument.text)) {
          add(argument, `mockConceptDescriptor(${JSON.stringify(argument.text)})`); return;
        }
      }
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "messageForKey") { add(node, descriptorText(node)); return; }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!changed) continue;
  // Runtime registry is intentionally small; assertion descriptors come from generated migration metadata.
  for (const statement of ast.statements) if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
    const names = statement.importClause.namedBindings.elements;
    if (names.length === 1 && names[0].name.text === "messageForKey") edits.push([statement.getStart(ast), statement.end, ""]);
  }
  let next = text;
  for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) next = next.slice(0, start) + value + next.slice(end);
  let helper = relative(dirname(resolve(file)), resolve("tests/helpers/real-i18n")).replaceAll("\\", "/");
  if (!helper.startsWith(".")) helper = "./" + helper;
  if (!text.includes(`from ${JSON.stringify(helper)}`)) next = `import { observeTranslation as mockObserveTranslation, englishText as mockEnglishText, conceptDescriptor as mockConceptDescriptor } from ${JSON.stringify(helper)};\n` + next;
  await writeFile(file, next);
  ledger.push({ file, edits: edits.length });
}
await writeFile("scripts/plugin-jest-migration.json", JSON.stringify([...new Map([...prior, ...ledger].map(row => [row.file, row])).values()], null, 2) + "\n");
console.log(`Migrated ${ledger.length} test files / ${ledger.reduce((count, row) => count + row.edits, 0)} sites to real catalogues.`);
