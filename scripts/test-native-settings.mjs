#!/usr/bin/env node
// Acceptance test against the real Obsidian renderer. Only run in a disposable/test vault.
// Usage: node scripts/test-native-settings.mjs --vault=test --artifacts=/absolute/path
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const option = (name, fallback) =>
	process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ??
	fallback;
const vault = option("vault", "test");
if (!/test|e2e|smoke/i.test(vault)) throw new Error("Refusing to mutate a non-test vault.");
const artifacts = resolve(option("artifacts", ".testbed/native-settings"));
mkdirSync(artifacts, { recursive: true });
const results = [];
function evaluate(body) {
	const code = `(async()=>{const p=app.plugins.plugins.tasknotes,t=app.setting.pluginTabs.find(tab=>tab.id==='tasknotes'),s=app.setting;
 const assert=(value,message)=>{if(!value)throw new Error(message)};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const current=()=>s.getCurrentPageEl();
 const row=name=>[...current().querySelectorAll('.setting-item-name')].find(el=>el.textContent===name)?.closest('.setting-item');
 const click=name=>{const el=row(name);assert(el,'Missing row: '+name);el.click()};
 const input=(name,value)=>{const el=row(name)?.querySelector('input:not([type=checkbox])');assert(el,'Missing input: '+name);el.focus();el.value=value;if(el.type==='text'||el.type==='password')el.setSelectionRange(value.length,value.length);el.dispatchEvent(new el.ownerDocument.defaultView.Event('input',{bubbles:true}));if(el.type==='number')el.dispatchEvent(new el.ownerDocument.defaultView.Event('change',{bubbles:true}));return el};
 const flatten=items=>items.flatMap(item=>[item,...(item.items?flatten(item.items):[])]);
 ${body}})()`;
	const out = execFileSync("obsidian", [`vault=${vault}`, "eval", `code=${code}`], {
		encoding: "utf8",
		maxBuffer: 4 * 1024 * 1024,
	});
	if (!out.includes("=> ")) throw new Error(out.trim());
	const value = out.slice(out.indexOf("=> ") + 3).trim();
	return value;
}
function test(name, code) {
	evaluate(code);
	results.push({ name, passed: true });
	console.log(`PASS ${name}`);
}
function screenshot(name, width = 1100, height = 850) {
	evaluate(
		`const wc=s.popout?.win.electronWindow.webContents;assert(wc,'Settings popout is required for screenshots');wc.enableDeviceEmulation({screenPosition:'desktop',screenSize:{width:${width},height:${height}},viewSize:{width:${width},height:${height}},deviceScaleFactor:1,scale:1});await wait(150);const image=await wc.capturePage({x:0,y:0,width:${width},height:${height}});require('fs').writeFileSync(${JSON.stringify(resolve(artifacts, name + ".png"))},image.toPNG());return 'captured';`
	);
}
let backup = false;
try {
	evaluate(
		`assert(!window.__tnNativeSettingsSmoke,'A previous smoke backup exists; restore it first');window.__tnNativeSettingsSmoke=structuredClone(p.settings);p.settings.uiLanguage='en';p.i18n.setLocale('en');s.open();s.openTabById('tasknotes');return 'ready';`
	);
	backup = true;
	test(
		"native search indexes unvisited settings",
		`s.searchComponent.setValue('pomodoro');const el=s.searchComponent.inputEl;el.dispatchEvent(new el.ownerDocument.defaultView.Event('input',{bubbles:true}));await wait(350);const result=[...s.searchResultsEl.querySelectorAll('.setting-search-result-item')].find(el=>el.textContent==='Work duration');assert(result,'Work duration missing from native search');result.click();await wait(100);assert(row('Work duration'),'Search did not open the correct page');assert(current().querySelector('.setting-page-title')?.textContent==='Time & reminders','Search should open the category containing the inline group');return 'ok';`
	);
	test(
		"native numeric validation blocks invalid values",
		`const before=p.settings.pomodoroWorkDuration;input('Work duration','0').blur();await wait(700);assert(p.settings.pomodoroWorkDuration===before,'Invalid duration was persisted');assert(current().innerText.includes('Enter a number')||row('Work duration').querySelector('input').validationMessage,'No native validation feedback');input('Work duration','27').blur();await wait(700);assert(p.settings.pomodoroWorkDuration===27,'Valid duration not applied: '+JSON.stringify({stored:p.settings.pomodoroWorkDuration,input:row('Work duration').querySelector('input').value,read:t.getControlValue('pomodoroWorkDuration')}));assert((await p.loadData()).pomodoroWorkDuration===27,'Duration not saved to disk');return 'ok';`
	);
	screenshot("pomodoro-desktop");
	evaluate(
		`s.searchComponent.setValue('');const el=s.searchComponent.inputEl;el.dispatchEvent(new el.ownerDocument.defaultView.Event('input',{bubbles:true}));await wait(250);s.openTabById('tasknotes');return 'ok';`
	);
	screenshot("root-desktop");
	test(
		"custom properties use native add and detail navigation",
		`click('Properties');await wait(50);const add=current().querySelector('[aria-label="Add user field"]');assert(add,'Native list add control missing');add.click();await wait(400);const entry=[...current().querySelectorAll('.setting-item-name')].filter(el=>el.textContent.startsWith('New property')).at(-1);assert(entry,'New property not listed');entry.closest('.setting-item').click();await wait(50);assert(row('Property key:'),'No property key control');assert(row('Autosuggestion filters (advanced)'),'Missing progressive disclosure');assert(row(p.i18n.translate('settings.taskProperties.propertyCard.triggerChar'))?.querySelector('input'),'NLP trigger should be editable inline');return 'ok';`
	);
	test(
		"name edits preserve focus and refresh list metadata",
		`input('Display name:','Native smoke property');await wait(700);assert(current().ownerDocument.activeElement?.value==='Native smoke property','Editing lost focus');assert(p.settings.userFields.at(-1).displayName==='Native smoke property','Name not saved');return 'ok';`
	);
	test(
		"duplicate property keys are rejected inline",
		`const field=p.settings.userFields.at(-1),before=field.key;input('Property key:',p.settings.fieldMapping.status).blur();await wait(700);assert(field.key===before,'Duplicate key was persisted');assert(row('Property key:').innerText.includes('Another property'),'Missing duplicate-key error');input('Property key:','native_smoke_property').blur();await wait(700);assert(field.key==='native_smoke_property','Valid property key not applied');return 'ok';`
	);
	test(
		"changing property type updates the native default control",
		`const el=row('Type:').querySelector('select');el.value='boolean';el.dispatchEvent(new el.ownerDocument.defaultView.Event('change',{bubbles:true}));await wait(500);assert(row('Default value:').querySelector('input[type=checkbox]'),'Boolean default is not a native toggle');row('Default value:').querySelector('input[type=checkbox]').click();await wait(500);assert(p.settings.userFields.at(-1).defaultValue===true,'Boolean default not persisted');return 'ok';`
	);
	screenshot("custom-property-desktop");
	test(
		"progressive filter page is navigable with native back controls",
		`click('Autosuggestion filters (advanced)');await wait(50);assert(row('Property name'),'Filter inputs missing');current().querySelector('.setting-page-back-button').click();await wait(50);assert(row('Type:'),'Back did not restore property editor');return 'ok';`
	);
	test(
		"parent list reflects renamed property",
		`current().querySelector('.setting-page-back-button').click();await wait(50);assert(row('Native smoke property'),'Parent still displays the old name');click('Native smoke property');return 'ok';`
	);
	test(
		"native keyboard focus follows form order",
		`const first=row('Display name:').querySelector('input');const browser=s.popout.win.electronWindow;browser.focus();const wc=browser.webContents;wc.focus();await wait(100);first.focus();wc.sendInputEvent({type:'keyDown',keyCode:'Tab'});wc.sendInputEvent({type:'keyUp',keyCode:'Tab'});await wait(150);assert(row('Property key:').contains(current().ownerDocument.activeElement),'Tab did not move to the next setting row: '+current().ownerDocument.activeElement?.outerHTML);return 'ok';`
	);
	screenshot("custom-property-small", 760, 900);
	evaluate(
		`current().ownerDocument.body.classList.add('is-mobile','is-phone');return 'mobile CSS enabled'`
	);
	screenshot("custom-property-phone-css", 390, 844);
	test(
		"no horizontal overflow in narrow native layout",
		`const page=current();assert(page.scrollWidth<=page.clientWidth+2,'Settings page overflows horizontally');return 'ok';`
	);
	evaluate(
		`current().ownerDocument.body.classList.remove('is-mobile','is-phone');return 'desktop CSS restored'`
	);
	test(
		"status labels refresh without leaving their editor",
		`s.openTabById('tasknotes');click('Properties');await wait(50);click('Status');await wait(50);const status=p.settings.customStatuses[0];click(status.label||status.value);await wait(50);const label=p.i18n.translate('settings.taskProperties.taskStatuses.fields.label');input(label,'Native smoke status');await wait(700);assert(p.settings.customStatuses[0].label==='Native smoke status','Status label not saved');assert(row(label),'Renaming lost the status editor');current().querySelector('.setting-page-back-button').click();await wait(50);assert(row('Native smoke status'),'Status list name is stale');return 'ok';`
	);
	test(
		"creation defaults and templates are inline groups",
		`s.openTabById('tasknotes');click('Task creation');await wait(100);const headings=[...current().querySelectorAll('.setting-item-heading')].map(el=>el.textContent);assert(headings.includes('Defaults')&&headings.includes('Templates'),'Creation settings are not grouped inline');return 'ok';`
	);
	screenshot("creation-inline-groups");
	test(
		"filenames are editable without opening another page",
		`s.openTabById('tasknotes');click('Task files');await wait(100);const heading=[...current().querySelectorAll('.setting-item-heading')].find(el=>el.textContent==='Filenames');assert(heading,'Filename group missing');heading.scrollIntoView({block:'start'});return 'ok';`
	);
	screenshot("filenames-inline-group");
	test(
		"localized definitions and native search aliases",
		`p.i18n.setLocale('de');t.update();const definitions=t.getSettingDefinitions();assert(definitions.some(item=>item.name==='Aufgabendateien'),'Navigation is not translated');assert(!flatten(definitions).some(item=>item.name?.startsWith('settings.')),'Unresolved translation key');s.openTabById('tasknotes');return 'ok';`
	);
	screenshot("root-german", 760, 900);
	evaluate(
		`window.__tnSmokeTheme=current().ownerDocument.body.className;current().ownerDocument.body.classList.remove('theme-dark');current().ownerDocument.body.classList.add('theme-light');return 'light CSS enabled'`
	);
	screenshot("root-light", 1100, 850);
	evaluate(
		`current().ownerDocument.body.className=window.__tnSmokeTheme;delete window.__tnSmokeTheme;return 'theme restored'`
	);
	test(
		"saved settings survive plugin reload",
		`await p.saveSettings();s.close();await app.plugins.disablePlugin('tasknotes');await app.plugins.enablePlugin('tasknotes');const reloaded=app.plugins.plugins.tasknotes;assert(reloaded.settings.pomodoroWorkDuration===27,'Duration lost on reload');assert(reloaded.settings.userFields.some(field=>field.key==='native_smoke_property'&&field.defaultValue===true),'Custom property lost on reload');return 'ok';`
	);
} catch (error) {
	try {
		writeFileSync(resolve(artifacts, "failure.html"), evaluate(`return current().outerHTML`));
	} catch {}
	results.push({ name: "acceptance run", passed: false, error: error.message });
	process.exitCode = 1;
	console.error(error.message);
} finally {
	if (backup) {
		try {
			evaluate(
				`s.popout?.win.electronWindow.webContents.disableDeviceEmulation();const doc=s.getCurrentPageEl()?.ownerDocument;if(doc&&window.__tnSmokeTheme){doc.body.className=window.__tnSmokeTheme;delete window.__tnSmokeTheme;}doc?.body.classList.remove('is-mobile','is-phone');p.settings=window.__tnNativeSettingsSmoke;await p.saveSettings();p.i18n.setLocale(p.settings.uiLanguage??'system');delete window.__tnNativeSettingsSmoke;t.update();s.open();s.openTabById('tasknotes');return 'restored';`
			);
		} catch (error) {
			process.exitCode = 1;
			console.error(
				"Restore failed; backup remains in window.__tnNativeSettingsSmoke:",
				error.message
			);
		}
	}
	writeFileSync(resolve(artifacts, "results.json"), JSON.stringify(results, null, 2) + "\n");
}
