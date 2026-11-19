import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
const entries = JSON.parse(await readFile("scripts/plugin-audit-diagnostics.json", "utf8"));
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const result = [];
for (const entry of entries) {
  const ast = ts.createSourceFile("error.ts", `const value = ${entry.source}`, ts.ScriptTarget.Latest, true);
  const expression = ast.statements[0].declarationList.declarations[0].initializer;
  const parts = ts.isTemplateExpression(expression) ? [expression.head.text, ...expression.templateSpans.map(span => span.literal.text)] : [expression.text];
  if (parts.some(part => typeof part !== "string")) throw new Error("Nonliteral diagnostic: " + entry.source);
  result.push({ ...entry, pattern: "^" + parts.map(escape).join("([\\s\\S]*?)") + "$", keys: entry.values.map(([key]) => key) });
}
// Specific static prefixes win over generic wrappers; remote/unrecognized errors remain data.
result.sort((a, b) => b.pattern.length - a.pattern.length);
const header = [
  "// Generated from audited plugin diagnostics; preserve raw throws/logs/API contracts.",
  'import { msg } from "@lingui/core/macro";',
  'import { uiData } from "./dataText";',
  "", "export const errorMessages = [",
].join("\n");
const rows = result.map(entry => {
  const data = Object.entries(entry.literals ?? {}).map(([key, value]) => `${JSON.stringify(key)}: uiData(${JSON.stringify(value)}, "CLI reminder protocol syntax/example; preserve tokens verbatim")`).join(", ");
  return `{ pattern: new RegExp(${JSON.stringify(entry.pattern)}), keys: ${JSON.stringify(entry.keys)}, dataValues: { ${data} }, descriptor: msg({ message: ${JSON.stringify(entry.message)}, context: ${JSON.stringify(entry.context)} }) },`;
});
await writeFile("src/i18n/errorMessages.ts", header + "\n" + rows.join("\n") + "\n];\n");
console.log(`Generated ${result.length} UI diagnostic descriptors.`);
