import ts from "typescript";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { toICU } from "./convert-lingui.mjs";
function descriptor(text, context) {
  const tokens = [];
  const message = toICU(text.replace(/!\[\[[^\]]+\]\]|https:\/\/[^\s)]+|(?<!`)`[^`\n]+`(?!`)/g, token => {
    tokens.push(token);return `{token${tokens.length}}`;
  }));
  return `uiText(msg({ message: ${JSON.stringify(message)}, context: ${JSON.stringify(context)} }), { ${tokens.map((token,index)=>`token${index+1}: ${JSON.stringify(token)}`).join(", ")} })`;
}
const starterFile="src/bootstrap/starterNote.ts";
const original=execFileSync("git",["show",`e70b7ba6:${starterFile}`],{encoding:"utf8"});
const ast=ts.createSourceFile(starterFile,original,ts.ScriptTarget.Latest,true);
let initializer;
for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(declaration.name.getText()==="STARTER_NOTE_CONTENT")initializer=declaration.initializer;
let lines;
function findArray(n){if(ts.isArrayLiteralExpression(n))lines=n.elements.map(element=>element.text);else ts.forEachChild(n,findArray);}findArray(initializer);
if(!lines?.every(line=>typeof line==="string"))throw new Error("Starter note source is no longer a literal array");
let source=await readFile(starterFile,"utf8");
const start=source.indexOf("export const STARTER_NOTE_CONTENT =");
const end=source.indexOf("export type StarterNoteResult");
if(start<0)throw new Error("Starter note already converted; manually review before rerunning");
source=source.slice(0,start)+`/** Generated tutorial prose; URLs, paths and code tokens are immutable parameters. */\nexport function getStarterNoteContent(): string {\n\treturn ${descriptor(lines.join("\n")+"\n","starter note Markdown")};\n}\n\n`+source.slice(end);
source='import { msg } from "@lingui/core/macro";\nimport { uiText } from "../i18n/runtime";\n'+source;
source=source.replace("vault.create(normalizedPath, STARTER_NOTE_CONTENT)","vault.create(normalizedPath, getStarterNoteContent())");
await writeFile(starterFile,source);
const release=await readFile("src/releaseNotesAnnouncement.md","utf8");
await writeFile("src/i18n/releaseNotesAnnouncement.ts",`// English input: src/releaseNotesAnnouncement.md. Links and technical code are protected parameters.\nimport { msg } from "@lingui/core/macro";\nimport { uiText } from "./runtime";\n\nexport function getReleaseNotesAnnouncement(): string {\n\treturn ${descriptor(release,"release announcement Markdown")};\n}\n`);
