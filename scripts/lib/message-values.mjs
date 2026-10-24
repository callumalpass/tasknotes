import ts from "typescript";
import { createRequire } from "node:module";
const requireKit = createRequire(import.meta.resolve("@mdbase-dev/i18n"));
const { parse } = requireKit("@messageformat/parser");
const propertyName = node => ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : undefined;
function argumentsIn(tokens, names = new Set()) {
  for (const token of tokens) {
    if (token.arg) names.add(token.arg);
    for (const arm of token.cases ?? []) argumentsIn(arm.tokens, names);
  }
  return names;
}
function objectKeys(node) {
  if (!node) return new Set();
  if (!ts.isObjectLiteralExpression(node) || node.properties.some(property => ts.isSpreadAssignment(property) || !propertyName(property.name))) return null;
  return new Set(node.properties.map(property => propertyName(property.name)));
}

/** Direct static call contracts only. Computed descriptors/forwarded value objects
 * remain covered by their typed adapters and runtime tests, not guessed here. */
export function inspectMessageValues(text, filename = "fixture.ts") {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const findings = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : "";
      const descriptor = node.arguments[0];
      if (["uiText", "translate", "uiRichText"].includes(name) && descriptor && ts.isCallExpression(descriptor) && ts.isIdentifier(descriptor.expression) && descriptor.expression.text === "msg" && descriptor.arguments[0] && ts.isObjectLiteralExpression(descriptor.arguments[0])) {
        const properties = descriptor.arguments[0].properties;
        const message = properties.find(property => ts.isPropertyAssignment(property) && propertyName(property.name) === "message")?.initializer;
        const embedded = properties.find(property => ts.isPropertyAssignment(property) && propertyName(property.name) === "values")?.initializer;
        const embeddedKeys = objectKeys(embedded), passedKeys = objectKeys(node.arguments[1]);
        if (message && ts.isStringLiteralLike(message) && embeddedKeys && passedKeys) {
          const provided = new Set([...embeddedKeys, ...passedKeys]);
          const missing = [...argumentsIn(parse(message.text))].filter(key => !provided.has(key));
          if (missing.length) findings.push({ file: filename, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, missing, provided: [...provided], message: message.text });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}
