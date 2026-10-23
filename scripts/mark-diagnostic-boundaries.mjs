// Make the presentation boundary explicit. Never rewrite a throw, log, API
// response or the raw local variable shared with those non-UI consumers.
import ts from "typescript";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
async function walk(dir) {
 for(const entry of await readdir(dir,{withFileTypes:true})) {
  const file=resolve(dir,entry.name);if(entry.isDirectory()){if(!["resources","locales"].includes(entry.name))await walk(file);continue;}
  if(!file.endsWith(".ts"))continue;
  let source=await readFile(file,"utf8");const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),edits=[];
  function containsErrorAccess(node){if(ts.isPropertyAccessExpression(node)&&node.name.text==="message")return true;return ts.forEachChild(node,containsErrorAccess)??false;}
  function visit(node) {
   if(ts.isCallExpression(node)&&/^(uiText|translate|translator|t|_)$/.test(ts.isPropertyAccessExpression(node.expression)?node.expression.name.text:node.expression.getText())&&node.arguments[0]&&ts.isCallExpression(node.arguments[0])&&node.arguments[0].expression.getText()==="msg"&&node.arguments[1]&&ts.isObjectLiteralExpression(node.arguments[1])) {
    for(const property of node.arguments[1].properties)if(ts.isPropertyAssignment(property)||ts.isShorthandPropertyAssignment(property)) {
     const value=ts.isPropertyAssignment(property)?property.initializer:property.name;
     if(ts.isCallExpression(value)&&value.expression.getText()==="displayError")continue;
     if(/error|message|guidance/i.test(property.name.getText())||containsErrorAccess(value)) {
      const replacement=`displayError(${value.getText()})`;
      edits.push({start:value.getStart(),end:value.end,text:ts.isShorthandPropertyAssignment(property)?`${property.name.getText()}: ${replacement}`:replacement});
     }
    }
   }
   ts.forEachChild(node,visit);
  }visit(ast);
  if(!edits.length)continue;
  for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  let module=relative(dirname(file),resolve("src/i18n/runtime")).replaceAll("\\","/");if(!module.startsWith("."))module="./"+module;
  if(!/import\s*\{[^}]*\bdisplayError\b[^}]*\}\s*from/.test(source))source=`import { displayError } from ${JSON.stringify(module)};\n`+source;
  await writeFile(file,source);console.log(relative(process.cwd(),file),edits.length);
 }
}
await walk(resolve("src"));
