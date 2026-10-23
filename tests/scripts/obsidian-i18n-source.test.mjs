import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { inspectObsidianSource, inspectFiniteConcepts } from "../../scripts/lib/obsidian-i18n-source.mjs";
function inspect(source, diagnostics = []) {
 const file="/fixture.ts", options={noLib:true,target:ts.ScriptTarget.ESNext};
 const host=ts.createCompilerHost(options);
 const text=`declare const el:any; declare function msg(value:any):any; declare function uiText(value:any):string; declare function uiData<T extends string>(value:T,reason:string):T; declare function displayError(value:unknown):string; declare class Error { message:string; constructor(message:string); }\n${source}`;
 host.getSourceFile=(path,version)=>path===file?ts.createSourceFile(path,text,version,true):undefined;
 host.fileExists=path=>path===file;host.readFile=path=>path===file?text:undefined;
 const program=ts.createProgram([file],options,host);
 return { issues:inspectObsidianSource(program,{include:path=>path===file,diagnostics}), finite:inspectFiniteConcepts(program,path=>path===file) };
}
for(const source of [
 'el.setText("Visible label");',
 'el.setName("Setting label");',
 'el.setDesc("Help sentence");',
 'el.setPlaceholder("Type a title");',
 'el.setButtonText("Confirm action");',
 'el.setTitle("Menu heading");',
 'el.createEl("button", {text:"Action name"});',
 'el.createDiv({attr:{title:"Tooltip phrase","aria-label":"Accessible phrase",placeholder:"Input hint"}});',
 'el.setAttribute("aria-label", "Accessible phrase");',
 'el.addCommand({id:"stable-id", name:"Command name"});',
 'el.addRibbonIcon("calendar", "Ribbon tooltip", ()=>{});',
 'new Notice("User notice");',
 'el.textContent = `Found ${3} tasks`;',
 'el.appendText("Description phrase");',
])test("rejects unmarked sink: "+source,()=>assert.ok(inspect(source).issues.some(issue=>issue.kind==="unmarked-ui-copy")));

test("rejects inline and conditional HTML callback pages",()=>{
 assert.ok(inspect('el.end("<!doctype html><title>English page</title>");').issues.length);
 assert.ok(inspect('el.end(flag ? "<title>English failure</title>" : "<title>English success</title>");').issues.length);
});
test("callback HTML builder owns title/body copy, not its locale identifier",()=>{
 assert.equal(inspect('oauthCallbackHtml("English title","English body","en");').issues.length,2);
 assert.equal(inspect('function render(){return oauthCallbackHtml(uiText(msg({message:"Title"})),uiText(msg({message:"Body"})),"en");}').issues.length,0);
});
test("JSON HTTP responses remain wire contracts, not HTML UI",()=>{
 assert.equal(inspect('el.end(JSON.stringify({message:"Stable machine contract"}));').issues.length,0);
});
test("DOM title assignments are UI, but similarly named DTO fields remain data",()=>{
 assert.equal(inspect('const task:{title:string}={title:""};task.title="Stored note title";').issues.length,0);
 assert.ok(inspect('declare const element:{nodeType:number;ownerDocument:unknown;title:string};element.title="Visible tooltip";').issues.some(issue=>issue.text==='"Visible tooltip"'));
});
test("traces local variables, arrays and returned helper text",()=>{
 assert.ok(inspect('const label="Unmarked label"; el.setText(label);').issues.length);
 assert.ok(inspect('function label(){ return "Unmarked helper"; } el.setText(label());').issues.length);
 assert.ok(inspect('const values=["Unmarked value"];el.setTitle(values[0]);').issues.length);
});
test("tracks only the UI-consumed fields across forwarded helpers",()=>{
 const result=inspect('function render(options:{name:string,id:string}) {el.setText(options.name);} render({name:"Visible heading",id:"stable-data-id"});');
 assert.equal(result.issues.length,1);assert.equal(result.issues[0].text,'"Visible heading"');
});
test("traces shorthand interpolation and destructured forwarding without mistaking select keys for copy",()=>{
 assert.ok(inspect('const label="English fragment";function render(){el.setText(uiText(msg({message:"Value: {label}"}),{label}));}').issues.some(issue=>issue.text==='"English fragment"'));
 assert.ok(inspect('function render({label}:{label:string}){el.setText(label);}render({label:"Unmarked forwarded label"});').issues.some(issue=>issue.text==='"Unmarked forwarded label"'));
 assert.equal(inspect('function render(){el.setText(uiText(msg({message:"{state, select, open {Open} other {Closed}}"}),{state:"open"}));}').issues.length,0);
 assert.ok(inspect('function render(){el.setText(uiText(msg({message:"Date: {date}"}),{date:"Tomorrow"}));}').issues.length);
});
test("map projection checks display fields, not the rest of persisted objects",()=>{
 assert.equal(inspect('const rows=[{id:"stable-wire-id",label:msg({message:"Label"})}];el.setText(rows.map(row=>uiText(row.label)).join(", "));').issues.length,0);
 assert.ok(inspect('const rows=[{id:"stable-wire-id",label:"Unmarked label"}];el.setText(rows.map(row=>row.label).join(", "));').issues.some(issue=>issue.text==='"Unmarked label"'));
});
test("follows nested helpers in array callbacks and checks find projections",()=>{
 assert.ok(inspect('const rows=[{label:"Unmarked callback label",id:"stable-id"}];function show(label:string){el.setText(label);}rows.forEach(row=>show(row.label));').issues.some(issue=>issue.text==='"Unmarked callback label"'));
 assert.ok(inspect('const rows=[{label:"Unmarked mapper label",id:"stable-id"}];function label(row:any){return row.label;}el.setText(rows.map(label).join(", "));').issues.some(issue=>issue.text==='"Unmarked mapper label"'));
 assert.ok(inspect('const rows=[{label:"Unmarked found label",id:"stable-id"}];el.setText(rows.find(row=>true).label);').issues.some(issue=>issue.text==='"Unmarked found label"'));
});
test("recursive array coercers converge without losing nested English copy",()=>{
 const result=inspect('function stringify(value:any):string{if(typeof value==="string")return value;if(Array.isArray(value))return value.map(item=>stringify(item)).join(", ");return "";}const input=[[["Hidden English"]]];el.setText(stringify(input));');
 assert.ok(result.issues.some(issue=>issue.text==='"Hidden English"'));
 assert.ok(result.issues.every(issue=>!issue.kind.startsWith("forwarding-")));
});
test("traces new-expression instance fields/getters",()=>{
 assert.ok(inspect('class Label {value="Unmarked class field";}const label=new Label();el.setText(label.value);').issues.some(issue=>issue.text==='"Unmarked class field"'));
 assert.ok(inspect('class Label {get value(){return "Unmarked class getter";}}const label=new Label();el.setText(label.value);').issues.some(issue=>issue.text==='"Unmarked class getter"'));
});
test("traces constructor parameter properties, without treating stable IDs as copy",()=>{
 const result=inspect('class Card {constructor(private options:{name:string,id:string}){} render(){el.setText(this.options.name);}}new Card({name:"Visible heading",id:"stable-id"});');
 assert.equal(result.issues.length,1);assert.equal(result.issues[0].text,'"Visible heading"');
});
test("permits real descriptors and deferred getters but rejects eager module translation",()=>{
 assert.equal(inspect('el.setText(uiText(msg({message:"Source",context:"fixture"})));').issues.length,1); // eager on a module, even in a call
 assert.equal(inspect('function render(){el.setText(uiText(msg({message:"Source"})));}').issues.length,0);
 assert.equal(inspect('const labels={get value(){return uiText(msg({message:"Source"}));}};el.setText(labels.value);').issues.length,0);
 assert.ok(inspect('const label=uiText(msg({message:"Source"}));').issues.some(issue=>issue.kind==="eager-module-translation"));
});
test("does not translate user data, CSS, protocol fields or valid filename syntax",()=>{
 assert.equal(inspect('declare const task:{title:string};el.setText(task.title);const request={method:"POST",body:"wire-value"};el.createEl("input",{attr:{class:"stable-css",type:"text"}});el.setPlaceholder("sample.json");').issues.length,0);
});
test("verbatim editable data requires a specific reviewed technical reason",()=>{
 assert.equal(inspect('el.setPlaceholder(uiData("status", "Editable YAML property identifier; must not be translated"));').issues.length,0);
 assert.ok(inspect('el.setTitle(uiData("Status", "ignore"));').issues.some(issue=>issue.kind==="unexplained-ui-data-boundary"));
});
test("requires error display boundaries and does not allow unregistered new English through them",()=>{
 assert.ok(inspect('declare const error:Error;el.setText(error.message);').issues.some(issue=>issue.kind==="unlocalized-error-boundary"));
 assert.ok(inspect('el.setText(displayError("New owned diagnostic"));').issues.some(issue=>issue.kind==="unmarked-ui-copy"));
 assert.equal(inspect('el.setText(displayError("Known diagnostic"));',[{source:'"Known diagnostic"'}]).issues.length,0);
});
test("proves finite descriptor selections and rejects any/string casts",()=>{
 const finite='declare function messageForKey(key:"a"|"b"):any;declare const key:"a"|"b";messageForKey(key);';
 assert.equal(inspect(finite).finite.issues.length,0);assert.deepEqual(inspect(finite).finite.sites[0].concepts,["a","b"]);
 assert.equal(inspect('declare function messageForKey(key:any):any;declare const key:string;messageForKey(key);').finite.issues.length,1);
 assert.equal(inspect('declare function messageForKey(key:any):any;messageForKey("a" as any);').finite.issues.length,1);
});
