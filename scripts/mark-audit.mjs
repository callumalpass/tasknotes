// Re-runnable audit-backed codemod. The original revision anchors locations;
// current AST matching prevents line drift from rewriting unrelated data.
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { toICU } from "./convert-lingui.mjs";
const apply = process.argv.includes("--apply");
const rows = JSON.parse(await readFile("scripts/plugin-unmarked.json", "utf8"));
const base = "e70b7ba6";
const ledger = [];
const errors = new Map();
const special = new Set(["src/bootstrap/starterNote.ts", "src/templates/defaultBasesFiles.ts", "src/releaseNotesAnnouncement.md", "src/modals/taskModalActionValues.ts", "src/i18n/I18nService.ts"]);
const files = [...new Set(rows.map(row => row.file))];
const normalize = text => text.replaceAll("\\n", "\n").replace(/\s+/g, " ").trim();
const name = node => node?.name?.getText().replaceAll('"', "").replaceAll("'", "") ?? "";
function owner(node) {
  const owners = [];
  for (let p = node.parent; p; p = p.parent) if (ts.isFunctionLike(p) || ts.isClassDeclaration(p)) {
    const n = name(p) || ((ts.isVariableDeclaration(p.parent) || ts.isPropertyAssignment(p.parent)) ? name(p.parent) : "");
    if (n) owners.unshift(n);
  }
  return owners.join(".");
}
function inFunction(node) {
  for (let p = node.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true;
  return false;
}
function marked(node) {
  for (let p = node.parent; p; p = p.parent) if (ts.isCallExpression(p) && /^(msg|uiText|messageForKey)$/.test(p.expression.getText())) return true;
  return false;
}
function literals(source) {
  const result = [];
  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) result.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);return result;
}
function isDiagnostic(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isNewExpression(p) && /Error$/.test(p.expression.getText())) return true;
    if (ts.isThrowStatement(p)) return true;
    if (ts.isCallExpression(p) && /^(super|.*[Ee]rror)$/.test(p.expression.getText())) return true;
    if (ts.isFunctionLike(p)) break;
  }
  return false;
}
function expressionName(expr, index, used) {
  let result = ts.isIdentifier(expr) ? expr.text : /error|message/i.test(expr.getText()) ? "message" :
    ts.isPropertyAccessExpression(expr) ? expr.name.text : `value${index + 1}`;
  if (used.has(result)) result += index + 1;
  used.add(result);return result;
}
function sourceMessage(node, plural = false) {
  if (ts.isStringLiteralLike(node)) return { message: toICU(node.text), values: [] };
  const used = new Set(); const values = [];
  let message = toICU(node.head.text); const suffixes = [];
  for (const [index, span] of node.templateSpans.entries()) {
    const expr = span.expression;
    if (ts.isConditionalExpression(expr) && [expr.whenTrue,expr.whenFalse].every(ts.isStringLiteralLike) &&
        ts.isBinaryExpression(expr.condition) && expr.condition.right.getText() === "1") {
      const condition = expr.condition;
      const count = ts.isBinaryExpression(condition) ? condition.left : undefined;
      if (count) {
        const countName = values.find(([,expression]) => expression === count.getText())?.[0] ?? (ts.isIdentifier(count) ? count.text : `count${index + 1}`);
        if (!values.some(([key]) => key === countName)) values.push([countName,count.getText()]);
        const marker = `@@suffix${suffixes.length}@@`;
        const singularWhenTrue = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(condition.operatorToken.kind);
        suffixes.push({ marker, countName, one: singularWhenTrue ? expr.whenTrue.text : expr.whenFalse.text, other: singularWhenTrue ? expr.whenFalse.text : expr.whenTrue.text });message += marker + toICU(span.literal.text);continue;
      }
    }
    const key = expressionName(expr,index,used); values.push([key,expr.getText()]);
    message += `{${key}}` + toICU(span.literal.text);
  }
  if (suffixes.length) {
    function expand(index, text) {
      if (index === suffixes.length) return text;
      const { marker,countName,one,other } = suffixes[index];
      return `{${countName}, plural, one {${expand(index+1,text.replace(marker,toICU(one)))}} other {${expand(index+1,text.replace(marker,toICU(other)))}}}`;
    }
    message = expand(0,message);
  } else if (plural) {
    const counted = values.find(([key,expr]) => /count|length|number|total|minutes|hours|days/i.test(key+expr));
    if (counted) message = `{${counted[0]}, plural, one {${message}} other {${message}}}`;
  }
  return { message, values };
}
function propertyContext(node) {
  for (let p=node.parent;p;p=p.parent) {
    if (ts.isPropertyAssignment(p)) return name(p);
    if (ts.isFunctionLike(p)) break;
  }
  return "display";
}
for (const file of files) {
  const items = rows.filter(row => row.file === file);
  if (special.has(file)) { ledger.push(...items.map(row=>({...row,state:row.kind==="not user-visible"?"excluded":"manual cluster"})));continue; }
  const original = execFileSync("git",["show",`${base}:${file}`],{encoding:"utf8"});
  let current = await readFile(file,"utf8");
  const oldAst = ts.createSourceFile(file,original,ts.ScriptTarget.Latest,true);
  const ast = ts.createSourceFile(file,current,ts.ScriptTarget.Latest,true);
  const oldNodes = literals(oldAst), nodes = literals(ast); const edits = new Map();
  const helpers = new Set(); let macro = false;
  for (const row of items) {
    if (row.kind === "not user-visible") { ledger.push({...row,state:"excluded"});continue; }
    if (row.kind === "locale formatting") {ledger.push({...row,state:"formatting pending"});continue;}
    const candidates = oldNodes.filter(node => {
      const start = oldAst.getLineAndCharacterOfPosition(node.getStart(oldAst)).line+1;
      const end = oldAst.getLineAndCharacterOfPosition(node.end).line+1;
      return start <= row.line && end >= row.line;
    });
    const exact = candidates.filter(node => node.text === row.code || normalize(node.getText(oldAst)) === normalize(row.code));
    let node = exact.sort((a,b)=>a.getWidth()-b.getWidth())[0];
    if (!node) {ledger.push({...row,state:"unmatched audit expression"});continue;}
    const matches = nodes.filter(candidate => candidate.getText(ast) === node.getText(oldAst) && owner(candidate) === owner(node) && !marked(candidate));
    const oldMatches = oldNodes.filter(candidate => candidate.getText(oldAst) === node.getText(oldAst) && owner(candidate) === owner(node));
    const index = oldMatches.indexOf(node);
    const target = matches[index] ?? (matches.length===1 ? matches[0] : undefined);
    if (!target) {ledger.push({...row,state:"already changed or ambiguous",owner:owner(node)});continue;}
    // Never overlap a containing whole-message edit with an inner fragment.
    const enclosing = [...edits.values()].find(edit=>edit.start<=target.getStart(ast)&&edit.end>=target.end);
    if (enclosing) {ledger.push({...row,state:"covered by whole message",context:enclosing.context});continue;}
    const { message,values } = sourceMessage(target,row.kind==="ICU plural");
    const context = `${file.replace(/^src\//, "").replace(/\.ts$/, "")}: ${owner(target)||"defaults"} ${propertyContext(target)}`;
    if (isDiagnostic(target) || /validation|returned|error detail|persistence error|authorization error|error or fallback/.test(row.sink)) {
      errors.set(context+message,{context,message,source:target.getText(ast),values,kind:row.kind});
      ledger.push({...row,state:"diagnostic boundary mapping",context});continue;
    }
    // Object getters defer seed/default labels until consumed; never eagerly translate modules.
    let start = target.getStart(ast), end = target.end;
    const descriptor = `msg({ message: ${JSON.stringify(message)}, context: ${JSON.stringify(context)} })`;
    let replacement = `uiText(${descriptor}${values.length ? `, { ${values.map(([key,value])=>`${key}: ${value}`).join(", ")} }` : ""})`;
    if (!inFunction(target)) {
      if (ts.isPropertyAssignment(target.parent) && target.parent.initializer === target) {
        start=target.parent.getStart(ast);end=target.parent.end;
        replacement=`get ${target.parent.name.getText(ast)}() { return ${replacement}; }`;
      } else {ledger.push({...row,state:"module seed pending",context});continue;}
    }
    for (const [key,edit] of edits) if (start<=edit.start&&end>=edit.end) edits.delete(key);
    edits.set(start,{start,end,replacement,context});macro=true;helpers.add("uiText");
    ledger.push({...row,state:"marked",context,message});
  }
  if (apply && edits.size) {
    for (const edit of [...edits.values()].sort((a,b)=>b.start-a.start)) current=current.slice(0,edit.start)+edit.replacement+current.slice(edit.end);
    if (macro && !/import \{[^}]*\bmsg\b[^}]*\} from ["']@lingui\/core\/macro/.test(current)) current='import { msg } from "@lingui/core/macro";\n'+current;
    let path=relative(dirname(resolve(file)),resolve("src/i18n/runtime")).replaceAll("\\","/");if(!path.startsWith("."))path="./"+path;
    if (helpers.size) current=`import { ${[...helpers].join(", ")} } from ${JSON.stringify(path)};\n`+current;
    await writeFile(file,current);
  }
}
await writeFile("scripts/plugin-audit-remediation.json",JSON.stringify(ledger,null,2)+"\n");
await writeFile("scripts/plugin-audit-diagnostics.json",JSON.stringify([...errors.values()],null,2)+"\n");
console.log(Object.fromEntries([...new Set(ledger.map(row=>row.state))].map(state=>[state,ledger.filter(row=>row.state===state).length])));
console.log("Diagnostic descriptors:",errors.size);
