// Explicitly localize audited raw diagnostics only where they enter a Notice.
// Throws, API responses, logs, filenames and user-authored text remain untouched.
import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
const diagnostics=JSON.parse(await readFile("scripts/plugin-audit-diagnostics.json","utf8"));
for(const file of [...new Set(diagnostics.map(entry=>"src/"+entry.context.split(":")[0]+".ts"))]) {
 let source=await readFile(file,"utf8");const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),edits=[];
 const sources=new Set(diagnostics.filter(entry=>file==="src/"+entry.context.split(":")[0]+".ts").map(entry=>entry.source));
 function visit(node){
  if((ts.isNewExpression(node)&&node.expression.getText()==="Notice") || (ts.isCallExpression(node)&&node.expression.getText()==="showNotice")) {
   const argument=node.arguments?.[0];if(argument&&sources.has(argument.getText()))edits.push({start:argument.getStart(ast),end:argument.end,text:`displayError(${argument.getText()})`});
  }ts.forEachChild(node,visit);
 }visit(ast);
 if(!edits.length)continue;
 for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
 let path=relative(dirname(resolve(file)),resolve("src/i18n/runtime")).replaceAll("\\","/");if(!path.startsWith("."))path="./"+path;
 if(source.includes(`from "${path}"`))source=source.replace(new RegExp(`import \\{([^}]+)\\} from "${path.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}";`),(_match,imports)=>`import { displayError,${imports} } from "${path}";`);
 else source=`import { displayError } from ${JSON.stringify(path)};\n`+source;
 await writeFile(file,source);console.log(file,edits.length);
}
