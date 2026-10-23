// One-time reviewed technical-data annotations from the consumer guard. No
// blanket source exclusions: every identity boundary names why data is verbatim.
import ts from "typescript";
import {readFile,writeFile}from"node:fs/promises";
import {resolve,relative,dirname}from"node:path";
const issues=JSON.parse(await readFile("dist/obsidian-i18n-source.json","utf8"));const ledger=[];
for(const file of new Set(issues.filter(i=>i.kind==="unmarked-ui-copy").map(i=>i.file))){
 let source=await readFile(file,"utf8");const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),edits=new Map();
 const findings=issues.filter(i=>i.file===file&&i.kind==="unmarked-ui-copy");
 function visit(node){
  if(findings.some(i=>i.text===node.getText()&&i.line===ast.getLineAndCharacterOfPosition(node.getStart()).line+1)){
   const value=ts.isStringLiteralLike(node)?node.text:node.getText();let reason;
   if(file==="src/bootstrap/starterNote.ts"&&ts.isPropertyAssignment(node.parent)&&/^token\d+$/.test(node.parent.name.getText()))reason="Immutable Markdown code, embed or vault path; preserve native syntax";
   else if(["Google Calendar","Google Cloud Console","Microsoft Outlook Calendar","Microsoft Outlook","Azure Portal"].includes(value)&&file==="src/settings/tabs/integrationsTab.ts")reason="Upstream product or console name; not plugin-authored prose";
   else if(value==="CSV"&&file==="src/bases/BasesViewBase.ts")reason="CSV interchange format name; preserve the standard acronym";
   else if(/^open-(advanced-calendar|tasks|agenda|kanban|calendar)-view$/.test(value)&&["src/bootstrap/pluginBootstrap.ts","src/commands/taskNotesCommands.ts","src/ui/WorkspaceNavigationService.ts"].includes(file))reason="Registered Obsidian command identifier; must match persisted mapping";
   else if(file==="src/components/TaskContextMenu.ts"&&(["due","scheduled","open","manual","on_completion","relative","PT0M"].includes(value)||value.startsWith("`rem_${")))reason="Persisted task/reminder discriminator or identifier; never localize wire data";
   else if(value==="normal"&&["src/services/PriorityManager.ts","src/utils/taskInfoAssembly.ts","src/modals/TaskModal.ts"].includes(file))reason="Persisted priority value; preserve user metadata and matching semantics";
   else if(value==="open"&&file==="src/modals/TaskModal.ts")reason="Persisted status value; preserve user metadata and matching semantics";
   else if(file==="src/services/CalendarExportService.ts"&&value.startsWith("`obsidian://"))reason="Obsidian deep-link URI; preserve the protocol and encoded vault/file data";
   else if(file==="src/ui/NotificationService.ts"&&value==="PT0S")reason="ISO 8601 zero-duration value; stored reminder protocol, not prose";
   else if(file==="src/settings/tabs/generalTab.ts"&&value.startsWith("`TaskNotes/Views/"))reason="Generated native Bases vault path; preserve saved command/file mapping";
   if(!reason)throw new Error(`Unreviewed data boundary ${file}: ${node.getText()}`);
   edits.set(node.getStart(),{start:node.getStart(),end:node.end,text:`uiData(${node.getText()}, ${JSON.stringify(reason)})`});
   ledger.push({file,line:ast.getLineAndCharacterOfPosition(node.getStart()).line+1,expression:node.getText(),reason});return;
  }ts.forEachChild(node,visit);
 }visit(ast);
 if(!edits.size)continue;
 for(const edit of [...edits.values()].sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
 let module=relative(dirname(resolve(file)),resolve("src/i18n/dataText")).replaceAll("\\","/");if(!module.startsWith("."))module="./"+module;
 if(!/import\s*\{[^}]*\buiData\b[^}]*\}\s*from/.test(source))source=`import { uiData } from ${JSON.stringify(module)};\n`+source;
 await writeFile(file,source);
}
await writeFile("scripts/plugin-param-remediation.json",JSON.stringify(ledger,null,2)+"\n");console.log(`Annotated ${ledger.length} reviewed technical data literals.`);
