import ts from "typescript";

const methods = new Set(["setText", "setName", "setDesc", "setPlaceholder", "setButtonText", "setTitle", "appendText"]);
const attributes = new Set(["title", "aria-label", "placeholder", "aria-description"]);
const translations = /^(?:uiText|uiRichText|msg|translate|translator|t|_)$/;
const formatters = new Set(["uiNumber", "uiPercent", "uiDuration", "formatUIDate", "formatStableDate", "uiLocale", "getNativeLanguageName"]);
const word = value => /[A-Za-z]{2}/.test(value);
function invariant(value) {
  return !word(value) || /^(?:https?:\/\/|mailto:)/.test(value) || /^(?:[\w./-]+)?\.(?:md|json|base|ics|yaml|yml)$/.test(value)
    || /^(?:HH:mm|hh:mm a|YYYY-MM-DD|#[0-9a-f]{3,8})$/i.test(value);
}
function unwrap(node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node))) node=node.expression;
  return node;
}
function literalShape(node) {
  if(ts.isStringLiteralLike(node))return JSON.stringify([node.text]);
  if(ts.isTemplateExpression(node))return JSON.stringify([node.head.text,...node.templateSpans.map(span=>span.literal.text)]);
  return null;
}
export function inspectObsidianSource(program, { include = () => true, diagnostics = [] } = {}) {
  const checker=program.getTypeChecker();const issues=new Map(),summaries=new Map();
  const files=program.getSourceFiles().filter(file=>!file.isDeclarationFile&&include(file.fileName));
  const diagnosticShapes=new Set(diagnostics.map(entry=>{
    const ast=ts.createSourceFile("diagnostic.ts","const value = "+entry.source,ts.ScriptTarget.Latest,true);
    return literalShape(ast.statements[0]?.declarationList?.declarations[0]?.initializer);
  }).filter(Boolean));
  const nodes=[];for(const file of files){function visit(n){nodes.push(n);ts.forEachChild(n,visit);}visit(file);}
  function report(node,kind,text=node.getText()) {
    const file=node.getSourceFile();const line=file.getLineAndCharacterOfPosition(node.getStart()).line+1;
    issues.set(`${file.fileName}:${node.pos}:${kind}`,{file:file.fileName,line,kind,text});
  }
  function declarations(node){let symbol=ts.isShorthandPropertyAssignment(node.parent)&&node.parent.name===node?checker.getShorthandAssignmentValueSymbol(node.parent):checker.getSymbolAtLocation(node);if(symbol?.flags&ts.SymbolFlags.Alias)symbol=checker.getAliasedSymbol(symbol);return symbol?.declarations??[];}
  let changed=false;
  function parameter(declaration,path,diagnostic) {
    if(!ts.isParameter(declaration))return false;
    const fn=declaration.parent;if(!fn.parameters)return true;
    const index=fn.parameters.indexOf(declaration);const key=JSON.stringify([index,path,diagnostic]);
    const entries=summaries.get(fn)??new Map();if(!entries.has(key)){entries.set(key,{index,path,diagnostic});summaries.set(fn,entries);changed=true;}
    return true;
  }
  function trace(node, path=[], seen=new Set(), diagnostic=false) {
    node=unwrap(node);if(!node)return;
    const token=`${node.getSourceFile().fileName}:${node.pos}:${path.join(".")}:${diagnostic}`;if(seen.has(token))return;seen.add(token);
    if(!path.length&&(ts.isStringLiteralLike(node)||ts.isTemplateExpression(node))){
      const shape=literalShape(node);if(diagnostic&&diagnosticShapes.has(shape))return;
      const fragments=ts.isTemplateExpression(node)?[node.head.text,...node.templateSpans.map(span=>span.literal.text)]:[node.text];
      if(fragments.some(value=>!invariant(value)))report(node,"unmarked-ui-copy");
      if(ts.isTemplateExpression(node))for(const span of node.templateSpans)trace(span.expression,[],seen,diagnostic);
      return;
    }
    if(ts.isConditionalExpression(node)){trace(node.whenTrue,path,seen,diagnostic);trace(node.whenFalse,path,seen,diagnostic);return;}
    if(ts.isBinaryExpression(node)){
      if([ts.SyntaxKind.PlusToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)){trace(node.left,path,seen,diagnostic);trace(node.right,path,seen,diagnostic);}return;
    }
    if(ts.isObjectLiteralExpression(node)){
      for(const prop of node.properties){
        if(ts.isSpreadAssignment(prop)){trace(prop.expression,path,seen,diagnostic);continue;}
        const name=prop.name?.getText().replace(/^['"]|['"]$/g,"");
        if(path.length&&path[0]!=="*"&&name!==path[0])continue;
        if(ts.isPropertyAssignment(prop))trace(prop.initializer,path.slice(1),seen,diagnostic);
        if(ts.isShorthandPropertyAssignment(prop))trace(prop.name,path.slice(1),seen,diagnostic);
        if(ts.isGetAccessorDeclaration(prop)&&prop.body)returns(prop.body,path.slice(1),seen,diagnostic);
      }return;
    }
    if(ts.isArrayLiteralExpression(node)){for(const element of node.elements)trace(element,path[0]==="*"?path.slice(1):path,seen,diagnostic);return;}
    if(ts.isPropertyAccessExpression(node)){
      if(node.name.text==="message"&&!diagnostic&&/Error/.test(checker.typeToString(checker.getTypeAtLocation(node.expression)))){report(node,"unlocalized-error-boundary");return;}
      trace(node.expression,[node.name.text,...path],seen,diagnostic);return;
    }
    if(ts.isElementAccessExpression(node)){
      const key=unwrap(node.argumentExpression);trace(node.expression,[ts.isStringLiteralLike(key)?key.text:"*",...path],seen,diagnostic);return;
    }
    if(node.kind===ts.SyntaxKind.ThisKeyword&&path.length) {
      const property=checker.getTypeAtLocation(node).getProperty(path[0]);
      for(const declaration of property?.declarations??[]) {
        if(parameter(declaration,path.slice(1),diagnostic))continue;
        if(declaration.initializer)trace(declaration.initializer,path.slice(1),seen,diagnostic);
        if(ts.isGetAccessorDeclaration(declaration)&&declaration.body)returns(declaration.body,path.slice(1),seen,diagnostic);
      }
      return;
    }
    if(ts.isCallExpression(node)||ts.isNewExpression(node)){
      const name=ts.isPropertyAccessExpression(node.expression)?node.expression.name.text:node.expression.getText();
      if(name==="uiData") {
        const reason=node.arguments?.[1];
        if(!reason||!ts.isStringLiteralLike(reason)||reason.text.trim().length<12)report(node,"unexplained-ui-data-boundary");
        return;
      }
      if(name==="displayError"){trace(node.arguments?.[0],path,seen,true);return;}
      if(diagnostic&&ts.isNewExpression(node)&&/Error$/.test(name)){trace(node.arguments?.[0],path,seen,true);return;}
      if(translations.test(name)||formatters.has(name)||name==="basesMessage")return;
      if(name==="getRecurrenceDisplayTextCore"||name==="toText"){report(node,"english-nlp-in-ui");return;}
      if(["map","flatMap"].includes(name)&&ts.isPropertyAccessExpression(node.expression)) {
        for(const argument of node.arguments??[])if(ts.isArrowFunction(argument)||ts.isFunctionExpression(argument)) {
          if(ts.isBlock(argument.body))returns(argument.body,path,seen,diagnostic);else trace(argument.body,path,seen,diagnostic);
          for(const summary of summaries.get(argument)?.values()??[])if(summary.index===0)trace(node.expression.expression,["*",...summary.path],seen,diagnostic||summary.diagnostic);
        }
        return;
      }
      if(["join","filter","trim","slice","replace","toUpperCase","toLowerCase"].includes(name)&&ts.isPropertyAccessExpression(node.expression)){
        trace(node.expression.expression,path,seen,diagnostic);
        if(name==="join")trace(node.arguments[0],[],seen,diagnostic);
        return;
      }
      const declaration=checker.getResolvedSignature(node)?.declaration;
      if(declaration?.body&&include(declaration.getSourceFile().fileName))returns(declaration.body,path,seen,diagnostic);
      return; // External APIs/user data have no authored UI literal to inspect.
    }
    if(ts.isIdentifier(node)){
      for(const declaration of declarations(node)){
        if(ts.isBindingElement(declaration)) {
          if(declaration.initializer)trace(declaration.initializer,path,seen,diagnostic);
          let parent=declaration;const fields=[];
          while(ts.isBindingElement(parent)) {
            const pattern=parent.parent;
            fields.unshift(ts.isArrayBindingPattern(pattern)?"*":(parent.propertyName??parent.name).getText().replace(/^['"]|['"]$/g,""));
            parent=pattern.parent;
          }
          if(!parameter(parent,[...fields,...path],diagnostic)&&parent.initializer)trace(parent.initializer,[...fields,...path],seen,diagnostic);
          continue;
        }
        if(parameter(declaration,path,diagnostic))continue;
        if(declaration.initializer)trace(declaration.initializer,path,seen,diagnostic);
        else if(ts.isGetAccessorDeclaration(declaration)&&declaration.body)returns(declaration.body,path,seen,diagnostic);
      }
      // A typed property on an instance can have a local initializer/getter.
      if(path.length){const property=checker.getTypeAtLocation(node).getProperty(path[0]);for(const declaration of property?.declarations??[]){if(declaration.initializer)trace(declaration.initializer,path.slice(1),seen,diagnostic);else if(ts.isGetAccessorDeclaration(declaration)&&declaration.body)returns(declaration.body,path.slice(1),seen,diagnostic);}}
    }
  }
  function returns(body,path,seen,diagnostic){function visit(n){if(ts.isReturnStatement(n)&&n.expression)trace(n.expression,path,seen,diagnostic);else if(n===body||!ts.isFunctionLike(n))ts.forEachChild(n,visit);}visit(body);}
  function sink(node,path=[],diagnostic=false){trace(node,path,new Set(),diagnostic);}
  const calls=nodes.filter(n=>ts.isCallExpression(n)||ts.isNewExpression(n));
  for(const node of nodes){
    if(ts.isCallExpression(node)||ts.isNewExpression(node)){
      const name=ts.isPropertyAccessExpression(node.expression)?node.expression.name.text:node.expression.getText();const args=node.arguments??[];
      if(methods.has(name)||name==="Notice"||name==="showNotice")sink(args[0]);
      if(name==="setTooltip")sink(args[1]);
      if(name==="addRibbonIcon")sink(args[1]);
      if(name==="publishUserNotice")trace(args[1],[],new Set(),true);
      if(name==="setAttribute"&&args[0]&&ts.isStringLiteralLike(args[0])&&attributes.has(args[0].text))sink(args[1]);
      if(["createEl","createDiv","createSpan"].includes(name)){
        const options=args[name==="createEl"?1:0];sink(options,["text"]);for(const attribute of attributes)sink(options,["attr",attribute]);
      }
      if(name==="addCommand"||name==="registerCommand")sink(args[0],["name"]);
      if(translations.test(name)&&name!=="msg"&&args[0]&&ts.isCallExpression(args[0])&&args[0].expression.getText()==="msg"&&ts.isObjectLiteralExpression(args[0].arguments[0])&&args[1]&&ts.isObjectLiteralExpression(args[1])) {
        const message=args[0].arguments[0].properties.find(prop=>prop.name?.getText().replaceAll('"',"")==="message")?.initializer;
        if(message&&ts.isStringLiteralLike(message))for(const prop of args[1].properties)if(ts.isPropertyAssignment(prop)||ts.isShorthandPropertyAssignment(prop)) {
          const key=prop.name.getText().replaceAll('"',"");
          if(message.text.includes(`{${key}}`)||new RegExp("\\{"+key+",\\s*(?:number|date|time)(?:,|\\})").test(message.text))sink(ts.isPropertyAssignment(prop)?prop.initializer:prop.name);
        }
      }
      if(name==="registerCliHandler")sink(args[1]);
      if(name==="render"&&node.expression.getText().startsWith("MarkdownRenderer."))sink(args[1]);
    }
    if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.EqualsToken,ts.SyntaxKind.PlusEqualsToken].includes(node.operatorToken.kind)&&ts.isPropertyAccessExpression(node.left)&&["textContent","innerText","placeholder","title","ariaLabel","ariaDescription"].includes(node.left.name.text))sink(node.right);
    if(ts.isCallExpression(node)&&node.expression.getText()==="uiText"){
      let scope=node.parent;while(scope&&!ts.isFunctionLike(scope)&&!ts.isClassLike(scope))scope=scope.parent;
      if(!scope)report(node,"eager-module-translation");
    }
  }
  // Propagate actual UI-consumed parameter fields across local forwarding helpers.
  // This is field-level, so command IDs, URLs, CSS and persisted discriminants stay data.
  for(let round=0;round<12;round++){
    changed=false;
    for(const call of calls){const declaration=checker.getResolvedSignature(call)?.declaration;for(const {index,path,diagnostic}of summaries.get(declaration)?.values()??[])sink(call.arguments?.[index],path,diagnostic);}
    if(!changed)break;
    if(round===11)report(files[0],"forwarding-analysis-did-not-converge","UI parameter flow exceeded 12 rounds");
  }
  return [...issues.values()].sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line);
}

export function inspectFiniteConcepts(program, include = () => true) {
  const checker=program.getTypeChecker(), issues=[], sites=[];
  const finite=type=>type.isStringLiteral()?[type.value]:type.isUnion()?type.types.flatMap(part=>finite(part)??[null]):null;
  for(const file of program.getSourceFiles()){
    if(file.isDeclarationFile||!include(file.fileName))continue;
    function visit(node){
      if(ts.isCallExpression(node)){
        const declaration=checker.getResolvedSignature(node)?.declaration;
        if(node.expression.getText()==="messageForKey"||declaration?.name?.getText()==="messageForKey"){
          const argument=node.arguments[0];const concepts=argument?finite(checker.getTypeAtLocation(argument)):null;
          const site={file:file.fileName,line:file.getLineAndCharacterOfPosition(node.getStart()).line+1,expression:argument?.getText()??"",concepts};
          sites.push(site);
          if(!concepts?.length||concepts.some(key=>key===null))issues.push({...site,kind:"unbounded-message-concept",text:site.expression});
        }
      }
      ts.forEachChild(node,visit);
    }visit(file);
  }
  return {issues,sites};
}
