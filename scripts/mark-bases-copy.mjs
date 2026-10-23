// One-time, audit-scoped transformation of generated Bases display text.
import { readFile, writeFile } from "node:fs/promises";
const file="src/templates/defaultBasesFiles.ts";let text=await readFile(file,"utf8");
const msg=(message,context)=>`msg({ message: ${JSON.stringify(message)}, context: ${JSON.stringify(context)} })`;
const label=value=>`JSON.stringify(uiText(${msg(value,"generated Bases grouping label")}))`;
function replaceLine(key,value){const re=new RegExp(`^(\\s*)${key}: .*?$`,"m");if(!re.test(text))throw new Error("Missing formula "+key);text=text.replace(re,(_all,space)=>`${space}${key}: ${value},`);}
const formula=(message,context,values)=>`basesMessage(${msg(message,context)}, { ${Object.entries(values).map(([key,expr])=>`${key}: ${expr}`).join(", ")} })`;
const remaining=formula("{days, plural, one {# day} other {# days}}","generated Bases due countdown",{days:'"formula.daysUntilDue"'});
const overdue=formula("{days, plural, one {# day overdue} other {# days overdue}}","generated Bases overdue countdown",{days:'"formula.daysUntilDue * -1"'});
replaceLine("dueIn",'`if(${dueIsEmpty}, "", if(formula.daysUntilDue == 0, ${'+label("Today")+'}, if(formula.daysUntilDue > 0, ${'+remaining+'}, ${'+overdue+'})))`');
for(const [property,field,labelText]of [["projectCount","projectsProperty","projects"],["contextCount","contextsProperty","contexts"]])replaceLine(property,formula(`{count, plural, =0 {No ${labelText}} one {Single ${labelText.slice(0,-1)}} other {Multiple ${labelText}}}`,`generated Bases ${labelText} count`,{count:'`if(${'+field+'}, list(${'+field+'}).length, 0)`'}));
const time='`list(${timeEntriesProperty}).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0)`';
// The values remain native numeric expressions, not translated executable syntax.
const compact=(hours,minutes)=>formula("{hours, number}h {minutes, number}m","generated Bases compact hours and minutes",{hours,minutes});
const minutes=expr=>formula("{minutes, number}m","generated Bases compact minutes",{minutes:expr});
const tracked=compact('`('+time.slice(1,-1)+' / 60).floor()`','`('+time.slice(1,-1)+' % 60).round()`');
const trackedMinutes=minutes('`'+time.slice(1,-1)+'.round()`');
replaceLine("timeTrackedFormatted",'`if(${timeEntriesProperty}, if(${'+time+'} >= 60, ${'+tracked+'}, ${'+trackedMinutes+'}), ${'+minutes('"0"')+'})`');
const ago=formula("{days, plural, one {# day ago} other {# days ago}}","generated Bases relative due date",{days:'"formula.daysUntilDue * -1"'});
text=text.replace('formula.daysUntilDue * -1 + "d ago"','${'+ago+'}');
// Literal formula labels, never formula field names, date formats, operators or IDs.
const labels=["No due date","Not scheduled","Overdue","Today","Tomorrow","Yesterday","This week","Later","No estimate","Quick (<30m)","Medium (30m-2h)","Long (>2h)","This month","Older","Not started","Under estimate","Over estimate","No date","Overdue/Past"];
for(const value of labels){const literal=JSON.stringify(value);text=text.split(literal).join('${'+label(value)+'}');}
// Restore macro source string literals altered by the mechanical literal substitution.
for(const value of labels){const changed='message: ${'+label(value)+'}';text=text.split(changed).join('message: '+JSON.stringify(value));}
// Only this formula was a single-quoted TS string rather than a template.
text=text.replace(/ageCategory: '([^\n]+)'/,(_match,body)=>'ageCategory: `'+body+'`');
text=text.replace(/^(\s*)name: "([^"\n]+)"/gm,(_m,space,value)=>`${space}name: \${JSON.stringify(uiText(${msg(value,"generated Bases view name")}))}`);
text=text.replace(/^(\s*)displayName: ([^\n]+)/gm,(_m,space,value)=>`${space}displayName: \${JSON.stringify(uiText(${msg(value,"generated Bases column name")}))}`);
const focus=compact('"(formula.focusMinutes / 60).floor()"','"(formula.focusMinutes % 60).round()"');
text=text.replace(/^  focusTime: .*$/m,'  focusTime: ${JSON.stringify(`if(formula.focusMinutes >= 60, ${'+focus+'}, ${'+minutes('"formula.focusMinutes"')+'})`)}');
const percent=formula("{percent, number}%","generated Bases completion percentage",{percent:'"if(formula.attemptedPomos > 0, (formula.completedPomos / formula.attemptedPomos * 100).round(), 0)"'});
text=text.replace(/^  completionRate: .*$/m,'  completionRate: ${JSON.stringify('+percent+')}');
text=text.replace('# Pomodoro statistics\n# Generated with your TaskNotes settings\n# Requires Pomodoro data storage to be set to Daily notes.','${uiText('+msg('Pomodoro statistics\nGenerated with your TaskNotes settings\nRequires Pomodoro data storage to be set to Daily notes.',"generated Pomodoro Bases documentation")+').split("\\n").map(line => "# " + line).join("\\n")}');
text='import { msg } from "@lingui/core/macro";\nimport { uiText } from "../i18n/runtime";\nimport { basesMessage } from "../i18n/basesMessages";\n'+text;
await writeFile(file,text);
