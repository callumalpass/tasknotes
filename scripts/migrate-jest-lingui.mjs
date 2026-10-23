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
  const expectedBy = node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && /^to(?:Be|Equal|Contain|Have)/.test(parent.expression.name.text) && parent.arguments.some(arg => arg.pos <= node.pos && arg.end >= node.end)) return parent;
    }
  };
  const english = (key, values) => `mockEnglishText(mockConceptDescriptor(${JSON.stringify(key)})${values ? `, ${JSON.stringify(values)}` : ""})`;
  const sentinel = value => {
    const text = value.replace(/^translated:/, "");
    if (Object.hasOwn(map, text)) return english(text);
    const key = Object.keys(map).find(key => text.startsWith(key + ":"));
    if (!key) return;
    const suffix = text.slice(key.length + 1), values = {};
    if (/^[A-Za-z]\w*=/.test(suffix)) for (const part of suffix.split(/,(?=[A-Za-z]\w*=)/)) {
      const index = part.indexOf("="); values[part.slice(0, index)] = part.slice(index + 1);
    } else {
      const names = [...new Set([...map[key].message.matchAll(/\{([A-Za-z]\w*)(?=[,}])/g)].map(match => match[1]))], parts = suffix.split(",");
      if (names.length !== parts.length) return;
      names.forEach((name, index) => values[name] = parts[index]);
    }
    return english(key, values);
  };
  function visit(node) {
    if (ts.isCallExpression(node) && ["mockEnglishText", "mockConceptDescriptor"].includes(node.expression.getText(ast))) return;
    if (descriptor(node)) {
      const assertion = expectedBy(node);
      const metadata = assertion && /(?:nameKey|labelKey|translate)/i.test(assertion.expression.expression.getText(ast));
      if (assertion && !metadata) add(node, `mockEnglishText(${descriptorText(node)})`);
      else if (node.expression.getText(ast) === "messageForKey") add(node, descriptorText(node));
      return; // Never reinterpret a descriptor's semantic context as expected UI text.
    }
    if (ts.isStringLiteral(node) && !ts.isImportDeclaration(node.parent)) {
      const assertion = expectedBy(node), binary = ts.isBinaryExpression(node.parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.parent.operatorToken.kind);
      if (node.text.startsWith("translated:") || assertion && !/translate/i.test(assertion.expression.expression.getText(ast)) || binary) {
        const replacement = sentinel(node.text); if (replacement) { add(node, replacement); return; }
      }
      const selector = node.text.match(/^(.*\[placeholder=["'])([^"']+)(["']\].*)$/);
      if (selector && Object.hasOwn(map, selector[2])) { add(node, `${JSON.stringify(selector[1])} + ${english(selector[2])} + ${JSON.stringify(selector[3])}`); return; }
    }
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.operatorToken.kind)) {
      for (const side of [node.left, node.right]) if (descriptor(side)) {
        const other = side === node.left ? node.right : node.left;
        if (descriptor(other) || /(?:nameKey|labelKey)\b/.test(other.getText(ast))) add(node, `${descriptor(side) ? descriptorText(side) : side.getText(ast)}.id ${node.operatorToken.getText(ast)} ${descriptor(other) ? descriptorText(other) : other.getText(ast)}.id`);
        else add(side, `mockEnglishText(${descriptorText(side)})`);
        return;
      }
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "renderUserFieldsSection") {
      let last = node.arguments.at(-1); while (last && (ts.isAsExpression(last) || ts.isParenthesizedExpression(last))) last = last.expression;
      if (last && ts.isArrowFunction(last)) { add(node.arguments.at(-1), "mockObserveTranslation()"); }
    }
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
