import ts from "typescript";
import {readFile,writeFile}from"node:fs/promises";
const config=ts.readConfigFile("tsconfig.json",ts.sys.readFile);const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());const program=ts.createProgram(parsed.fileNames,parsed.options),checker=program.getTypeChecker();
const legacy=new Set(Object.values(JSON.parse(await readFile("scripts/plugin-key-map.json","utf8"))).map(entry=>entry.context));
let changed=0;
for(const file of program.getSourceFiles()){
 if(!file.fileName.startsWith(process.cwd()+"/src/")||/\/i18n\/(resources|locales)\//.test(file.fileName)||file.isDeclarationFile)continue;
 const edits=new Map();
 function numeric(type){return (type.flags&ts.TypeFlags.NumberLike)!==0 || type.isUnion()&&type.types.every(numeric);}
 function visit(node){
  if(ts.isCallExpression(node)&&node.arguments.length>=2&&/^(uiText|translate|t)$/.test(ts.isPropertyAccessExpression(node.expression)?node.expression.name.text:node.expression.getText())){
   const descriptor=node.arguments[0],values=node.arguments[1];
   if(ts.isCallExpression(descriptor)&&descriptor.expression.getText()==="msg"&&ts.isObjectLiteralExpression(descriptor.arguments[0])&&ts.isObjectLiteralExpression(values)){
    const object=descriptor.arguments[0],property=name=>object.properties.find(p=>p.name?.getText().replaceAll('"',"")===name);
    const message=property("message")?.initializer,context=property("context")?.initializer;
    if(message&&ts.isStringLiteralLike(message)&&(!context||!legacy.has(context.text))){
     let text=message.text;
     for(const value of values.properties)if(ts.isPropertyAssignment(value)||ts.isShorthandPropertyAssignment(value)){
      const key=value.name.getText().replaceAll('"',"");const expression=ts.isPropertyAssignment(value)?value.initializer:value.name;
      if(numeric(checker.getTypeAtLocation(expression)))text=text.replaceAll(`{${key}}`,`{${key}, number}`);
     }
     if(text!==message.text)edits.set(message.getStart(),{start:message.getStart(),end:message.end,text:JSON.stringify(text)});
    }
   }
  }ts.forEachChild(node,visit);
 }visit(file);
 if(edits.size){let text=file.text;for(const edit of [...edits.values()].sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.text+text.slice(edit.end);await writeFile(file.fileName,text);changed+=edits.size;}
}
console.log(`Added explicit locale number formatting to ${changed} new display messages; legacy contracts untouched.`);
