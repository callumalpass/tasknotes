import ts from "typescript";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
const rows = JSON.parse(await readFile("scripts/plugin-unmarked.json", "utf8")).filter(row=>row.kind === "locale formatting");
const ledger=[];
function owner(node) {const result=[];for(let p=node.parent;p;p=p.parent)if(ts.isFunctionLike(p))result.unshift(p.name?.getText()??p.parent?.name?.getText()??"");return result.join(".");}
function nodes(ast) {const result=[];function visit(n){result.push(n);ts.forEachChild(n,visit);}visit(ast);return result;}
function importFrom(file,module,helpers){let path=relative(dirname(resolve(file)),resolve(module)).replaceAll("\\","/");if(!path.startsWith("."))path="./"+path;return `import { ${[...helpers].join(", ")} } from ${JSON.stringify(path)};\n`;}
for(const file of [...new Set(rows.map(row=>row.file))]) {
 const old=execFileSync("git",["show",`e70b7ba6:${file}`],{encoding:"utf8"});let source=await readFile(file,"utf8");
 const base=ts.createSourceFile(file,old,ts.ScriptTarget.Latest,true),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 const oldNodes=nodes(base),currentNodes=nodes(ast),edits=new Map(),helpers=new Set(),runtime=new Set();
 for(const row of rows.filter(row=>row.file===file)) {
  const candidates=oldNodes.filter(n=>base.getLineAndCharacterOfPosition(n.getStart(base)).line+1<=row.line && base.getLineAndCharacterOfPosition(n.end).line+1>=row.line);
  const call=candidates.filter(ts.isCallExpression).sort((a,b)=>a.getWidth()-b.getWidth()).find(n=>n.expression.getText()==="format" || /\.toLocale(DateString|TimeString|String)$/.test(n.expression.getText()));
  if(call) {
   const target=currentNodes.find(n=>ts.isCallExpression(n)&&n.getText()===call.getText()&&owner(n)===owner(call));
   if(!target){ledger.push({...row,state:"already changed or manual"});continue;}
   if(call.expression.getText()==="format") {
    const stable=/filenameGenerator|folderTemplateProcessor|templateProcessor|createCompat/.test(file);
    const helper=stable?"formatStableDate":"formatUIDate";helpers.add(helper);
    edits.set(target.expression.getStart(ast),{start:target.expression.getStart(ast),end:target.expression.end,text:helper});
    ledger.push({...row,state:stable?"stable filename/template tokens; explicit English locale":"locale-aware display date"});
   }else {
    const args=target.arguments.map(arg=>arg.getText(ast));args[0]="uiLocale()";runtime.add("uiLocale");
    edits.set(target.getStart(ast),{start:target.getStart(ast),end:target.end,text:`${target.expression.getText(ast)}(${args.join(", ")})`});
    ledger.push({...row,state:"explicit active UI locale"});
   }continue;
  }
  // The user-configured date-format wrappers are fixed centrally above.
  if(/formatDate(Time)?ForDisplay/.test(row.code)){ledger.push({...row,state:"localized through dateUtils display wrapper"});continue;}
  const number=candidates.filter(ts.isCallExpression).find(n=>/\.toString$/.test(n.expression.getText()) || (n.expression.getText()==="String"&&/getUTCDate/.test(n.getText())));
  if(number) {
   const target=currentNodes.find(n=>ts.isCallExpression(n)&&n.getText()===number.getText()&&owner(n)===owner(number));
   if(target){const expr=ts.isPropertyAccessExpression(target.expression)?target.expression.expression.getText():target.arguments[0].getText();helpers.add("uiNumber");edits.set(target.getStart(ast),{start:target.getStart(ast),end:target.end,text:`uiNumber(${expr})`});ledger.push({...row,state:"locale-aware display number"});continue;}
  }
  const template=candidates.filter(ts.isTemplateExpression).sort((a,b)=>a.getWidth()-b.getWidth())[0];
  if(template) {
   const target=currentNodes.find(n=>ts.isTemplateExpression(n)&&n.getText()===template.getText()&&owner(n)===owner(template));
   if(target) {
    const spans=target.templateSpans,parts=[target.head.text,...spans.map(span=>span.literal.text)];
    let text;
    if(parts.join("")==="%" && spans.length===1) {helpers.add("uiPercent");text=`uiPercent(${spans[0].expression.getText()})`;}
    else if(parts.join("").replaceAll(" ","")==="hm"&&spans.length===2){helpers.add("uiDuration");text=`uiDuration((${spans[0].expression.getText()}) * 60 + (${spans[1].expression.getText()}))`;}
    else if(parts.join("")==="m"&&spans.length===1){helpers.add("uiDuration");text=`uiDuration(${spans[0].expression.getText()})`;}
    else if(/^ \(\/?\)$/.test(parts.join("")) || /^ \(\/\)$/.test(parts.join(""))) {
      helpers.add("uiNumber");text="`"+target.head.rawText+spans.map(span=>"${uiNumber("+span.expression.getText()+")}"+span.literal.rawText).join("")+"`";
    }
    if(text){edits.set(target.getStart(ast),{start:target.getStart(ast),end:target.end,text});ledger.push({...row,state:"localized numeric/duration/percentage output"});continue;}
   }
  }
  ledger.push({...row,state:"manual formatting cluster"});
 }
 if(edits.size){for(const edit of [...edits.values()].sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);if(helpers.size)source=importFrom(file,"src/i18n/formatters",helpers)+source;if(runtime.size)source=importFrom(file,"src/i18n/runtime",runtime)+source;await writeFile(file,source);}
}
await writeFile("scripts/plugin-format-remediation.json",JSON.stringify(ledger,null,2)+"\n");
console.log(Object.fromEntries([...new Set(ledger.map(row=>row.state))].map(state=>[state,ledger.filter(row=>row.state===state).length])));
for(const row of ledger.filter(row=>row.state.includes("manual")))console.log(`${row.file}:${row.line}: ${row.code}`);
