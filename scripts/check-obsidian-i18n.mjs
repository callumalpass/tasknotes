import ts from "typescript";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { relative } from "node:path";
import { inspectObsidianSource, inspectFiniteConcepts } from "./lib/obsidian-i18n-source.mjs";
const root=process.cwd();
const config=ts.readConfigFile("tsconfig.json",ts.sys.readFile);
if(config.error)throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,"\n"));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
const program=ts.createProgram(parsed.fileNames,parsed.options);
/** Select plugin source by its repository path on Windows and POSIX. */
const include = (file) => {
  // TypeScript inputs and node:path output can use different path separators.
  const repoPath = relative(root, file).replaceAll("\\", "/");
  return repoPath.startsWith("src/") && !/^src\/(?:locales\/|i18n\/resources\/)/.test(repoPath);
};
const sourceCount = program.getSourceFiles().filter(file => !file.isDeclarationFile && include(file.fileName)).length;
if (!sourceCount) throw new Error("Obsidian UI guard found no plugin source files");
const diagnostics=JSON.parse(await readFile("scripts/plugin-audit-diagnostics.json","utf8"));
const finite=inspectFiniteConcepts(program,include);
const issues=[...inspectObsidianSource(program,{include,diagnostics}),...finite.issues].map(issue=>({...issue,file:relative(root,issue.file)}));
await mkdir("dist",{recursive:true});await writeFile("dist/obsidian-i18n-source.json",JSON.stringify(issues,null,2)+"\n");
await writeFile("dist/plugin-dynamic-sites.json",JSON.stringify(finite.sites.map(site=>({...site,file:relative(root,site.file)})),null,2)+"\n");
for(const issue of issues)console.error(`${issue.file}:${issue.line} ${issue.kind}: ${issue.text}`);
if(issues.length){console.error(`Obsidian UI guard: ${issues.length} issues`);process.exitCode=1;}else console.log(`Obsidian UI guard: passed for ${sourceCount} source files`);
