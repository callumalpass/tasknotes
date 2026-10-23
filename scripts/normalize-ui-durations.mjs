import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
for(const file of ["src/views/StatsView.ts","src/views/PomodoroStatsView.ts"]) {
 let source=await readFile(file,"utf8");const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),edits=[];
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText()==="formatTime"&&node.initializer&&ts.isArrowFunction(node.initializer))edits.push({start:node.initializer.body.getStart(ast),end:node.initializer.body.end,text:"uiDuration(minutes)"});ts.forEachChild(node,visit);}visit(ast);
 for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
 if(file.includes("PomodoroStats"))source=source.replace("import { formatUIDate, uiNumber, uiPercent }", "import { formatUIDate, uiNumber, uiPercent, uiDuration }");
 await writeFile(file,source);
}
