// Reviewed first-pass guard findings. Verbatim values have narrow technical reasons.
import ts from "typescript";
import { readFile,writeFile } from "node:fs/promises";
import { resolve,relative,dirname } from "node:path";
const findings=(await readFile("/tmp/plugin-port-obsidian-source1.log","utf8")).split("\n").flatMap(line=>{
 const match=line.match(/^(src\/[^:]+):(\d+) unmarked-ui-copy: (.+)$/);return match?[{file:match[1],line:Number(match[2]),code:match[3]}]:[];
});
const ledger=[];
for(const file of [...new Set(findings.map(x=>x.file))]) {
 if(["src/ui/calendarExportActions.ts","src/utils/stringUtils.ts","src/services/CalendarExportService.ts","src/modals/FileSelectorModal.ts"].includes(file))continue;
 let source=await readFile(file,"utf8");const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),edits=[],imports=new Set();
 function nodes(node,out=[]){out.push(node);ts.forEachChild(node,n=>{nodes(n,out);});return out;}const all=nodes(ast);
 for(const row of findings.filter(x=>x.file===file)){
  const node=all.find(n=>n.getText(ast)===row.code&&ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1===row.line);if(!node)throw new Error("Source drift "+JSON.stringify(row));
  let reason;
  if(file.includes("taskProperties")&&file!=="src/settings/tabs/taskProperties/priorityPropertyCard.ts"&&row.code!==JSON.stringify("untitled"))reason="Editable frontmatter property identifier or filename-template syntax, not a display label";
  if(file.endsWith("priorityPropertyCard.ts")&&row.code==='"priority"')reason="Editable frontmatter property identifier; must remain compatible with existing YAML";
  if(file.endsWith("generalTab.ts"))reason="Example vault folder path, tag identifier or filename-template syntax; preserve the entered data contract";
  if(file.endsWith("integrationsTab.ts"))reason=row.code.includes("Calendar")?"Proper Microsoft product name, not translatable UI copy":"Example OAuth credential syntax; credential identifiers must not be translated";
  if(file.endsWith("dependencyUtils.ts"))reason="RFC 5545 dependency relationship wire identifier, also displayed verbatim as metadata";
  if(file.endsWith("themeColors.ts"))reason="CSS color literal/name examples; translated words would not parse as CSS colors";
  const context=file.includes("helpers")?"Bases data inspector":file.includes("CalendarView")?"calendar refresh subscriptions button":file.includes("taskCardProperties")?"empty task property display":"untitled custom status or priority heading";
  const message=ts.isStringLiteralLike(node)?(node.text==="untitled"?"Untitled":node.text):null;
  let replacement;
  if(reason){imports.add("uiData");replacement=`uiData(${row.code}, ${JSON.stringify(reason)})`;}
  else if(message!==null){imports.add("uiText");imports.add("msg");replacement=`uiText(msg({ message: ${JSON.stringify(message)}, context: ${JSON.stringify(context)} }))`;}
  else if(ts.isTemplateExpression(node)){
   const names=node.templateSpans.map((_,i)=>"value"+(i+1));let message=node.head.text;
   node.templateSpans.forEach((span,i)=>message+=`{${names[i]}, number}`+span.literal.text);
   if(row.code.includes("item.path"))message="Path: {path}";
   const values=row.code.includes("item.path")?"path: item.path":node.templateSpans.map((span,i)=>names[i]+": "+span.expression.getText()).join(", ");
   replacement=`uiText(msg({ message: ${JSON.stringify(message)}, context: ${JSON.stringify(context)} }), { ${values} })`;imports.add("uiText");imports.add("msg");
  }else throw new Error("Unhandled "+row.code);
  edits.push({start:node.getStart(ast),end:node.end,replacement});ledger.push({...row,reason:reason??"localized human UI copy",context:reason?undefined:context});
 }
 for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.replacement+source.slice(edit.end);
 for(const helper of imports){const module=helper==="msg"?"@lingui/core/macro":relative(dirname(resolve(file)),resolve("src/i18n",helper==="uiData"?"dataText":"runtime")).replaceAll("\\","/");const path=module.startsWith(".")||module.startsWith("@")?module:"./"+module;
  const re=new RegExp('import \\{([^}]+)\\} from ["\\\']'+path.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+'["\\\'];');
  if(re.test(source))source=source.replace(re,(match,names)=>names.split(",").map(x=>x.trim()).includes(helper)?match:`import { ${helper}, ${names.trim()} } from ${JSON.stringify(path)};`);
  else source=`import { ${helper} } from ${JSON.stringify(path)};\n`+source;
 }
 await writeFile(file,source);
}
await writeFile("scripts/plugin-guard-remediation.json",JSON.stringify(ledger,null,2)+"\n");
