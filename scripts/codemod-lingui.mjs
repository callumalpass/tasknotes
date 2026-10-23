import ts from "typescript";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { relative, dirname, resolve } from "node:path";
const root = process.cwd();
const map = JSON.parse(await readFile("scripts/plugin-key-map.json", "utf8"));
const roots = process.argv.includes("--tests") ? ["tests"] : ["src"];
let count = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) { if (!/\/src\/(i18n|locales)$/.test(file)) await walk(file); continue; }
    if (!file.endsWith(".ts") || file.endsWith(".d.ts")) continue;
    let text = await readFile(file, "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const edits = []; let macro = false, dynamic = false;
    function visit(node) {
      // No edits inside already-migrated macros (idempotency).
      if (ts.isCallExpression(node) && node.expression.getText(source) === "msg") return;
      if (ts.isStringLiteral(node) && Object.hasOwn(map, node.text) && !ts.isLiteralTypeNode(node.parent) &&
          !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) &&
          !(ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent))) {
        const { message, context } = map[node.text];
        edits.push([node.getStart(source), node.end, `msg({ message: ${JSON.stringify(message)}, context: ${JSON.stringify(context)} })`]); macro = true; count++; return;
      }
      // Dynamic concept selectors use the finite generated descriptor registry, not runtime IDs.
      if (ts.isTemplateExpression(node) &&
          (Object.keys(map).some(key => key.startsWith(node.head.text) && node.head.text.includes("."))) &&
          ts.isCallExpression(node.parent) && node.parent.expression.getText(source) !== "messageForKey") {
        edits.push([node.getStart(source), node.end, `messageForKey(${node.getText(source)})`]); dynamic = true; return;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    if (!edits.length) continue;
    for (const [start, end, value] of edits.sort((a,b) => b[0]-a[0])) text = text.slice(0,start)+value+text.slice(end);
    if (macro && !/import \{[^}]*\bmsg\b[^}]*\} from ["']@lingui\/core\/macro/.test(text)) text = 'import { msg } from "@lingui/core/macro";\n'+text;
    if (dynamic) {
      let path = relative(dirname(file), resolve(root, "src/i18n/messages")).replaceAll("\\", "/");
      if (!path.startsWith(".")) path = "./"+path;
      text = `import { messageForKey } from ${JSON.stringify(path)};\n`+text;
    }
    await writeFile(file,text);
  }
}
for (const dir of roots) await walk(resolve(root, dir));
console.log(`Migrated ${count} literal call sites/configuration descriptors.`);
