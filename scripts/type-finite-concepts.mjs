import ts from "typescript";
import {readFile,writeFile,readdir}from"node:fs/promises";
import {resolve,relative,dirname}from"node:path";
const prefixes=new Set(["views.taskList.movement.","views.basesCalendar.settings.","settings.integrations.googleCalendarExport.eventDescription.","services.notification.missed.","ui.taskCard."]);
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory()){if(!["resources","locales"].includes(entry.name))await walk(path);continue;}if(!path.endsWith(".ts")||path.endsWith("/i18n/messages.ts"))continue;
 let source=await readFile(path,"utf8");const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true),edits=new Map();
 function visit(node){if(ts.isCallExpression(node)&&node.expression.getText()==="messageForKey"&&ts.isTemplateExpression(node.arguments[0])&&prefixes.has(node.arguments[0].head.text)){
  for(let parent=node.parent;parent;parent=parent.parent)if(ts.isFunctionLike(parent)){const key=parent.parameters?.find(p=>p.name.getText()==="key");if(key?.type?.kind===ts.SyntaxKind.StringKeyword){edits.set(key.type.getStart(),{start:key.type.getStart(),end:key.type.end,text:`MessageSuffix<${JSON.stringify(node.arguments[0].head.text)}>`});break;}}
 }ts.forEachChild(node,visit);}visit(ast);
 if(!edits.size)continue;for(const edit of [...edits.values()].sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
 let module=relative(dirname(path),resolve("src/i18n/concepts")).replaceAll("\\","/");if(!module.startsWith("."))module="./"+module;
 source=`import type { MessageSuffix } from ${JSON.stringify(module)};\n`+source;
 if(path.endsWith("/bases/calendarViewOptions.ts"))source=source.replace("type Translate = (key: string)", 'type Translate = (key: MessageSuffix<"views.basesCalendar.settings.">)');
 await writeFile(path,source);
}}
await walk(resolve("src"));
