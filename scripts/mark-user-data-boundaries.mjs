// Reviewed metadata-only call sites. Generic link/text renderers remain checked.
import ts from "typescript";import{readFile,writeFile}from"node:fs/promises";import{resolve,relative,dirname}from"node:path";
const files=["src/bases/groupTitleRenderer.ts","src/modals/taskModalDependencies.ts","src/ui/taskCardProperties.ts","src/modals/UnscheduledTasksSelectorModal.ts","src/ui/renderers/linkRenderer.ts","src/main.ts"];
const ledger=[];
for(const file of files){let text=await readFile(file,"utf8");const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),edits=[];
 function mark(node,reason){if(ts.isCallExpression(node)&&node.expression.getText()==="uiData")return;edits.push({start:node.getStart(),end:node.end,text:`uiData(${node.getText()}, ${JSON.stringify(reason)})`});ledger.push({file,line:ast.getLineAndCharacterOfPosition(node.getStart()).line+1,expression:node.getText(),reason});}
 function visit(node){
  if(ts.isCallExpression(node)&&["appendInternalLink","appendExternalLink"].includes(node.expression.getText())&&node.arguments[2])mark(node.arguments[2],"Resolved vault/Markdown link alias or filename; preserve user-authored link data");
  if(file==="src/main.ts"&&ts.isCallExpression(node)&&node.arguments[0]&&ts.isCallExpression(node.arguments[0])&&node.arguments[0].expression.getText()==="msg"&&node.arguments[0].getText().includes('context: "notices.commands.statusChanged"')&&ts.isObjectLiteralExpression(node.arguments[1]))for(const property of node.arguments[1].properties)if(ts.isPropertyAssignment(property)&&property.name.getText()==="status")mark(property.initializer,"User-configured status label/value; never rewrite stored metadata");
  ts.forEachChild(node,visit);
 }visit(ast);if(!edits.length)continue;
 for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.text+text.slice(edit.end);
 let module=relative(dirname(resolve(file)),resolve("src/i18n/dataText")).replaceAll("\\","/");if(!module.startsWith("."))module="./"+module;
 if(!/import\s*\{[^}]*\buiData\b[^}]*\}\s*from/.test(text))text=`import { uiData } from ${JSON.stringify(module)};\n`+text;await writeFile(file,text);
}
await writeFile("scripts/plugin-user-data-boundaries.json",JSON.stringify(ledger,null,2)+"\n");
