import { test, expect } from '@playwright/test';
import { parse } from 'yaml';
import {
	launchObsidian,
	closeObsidian,
	revealTaskNotesSetting,
	nativeSettingRow,
	closeObsidianSettings,
	type ObsidianApp,
} from '../obsidian';

let instance: ObsidianApp;
const folder = `Issue2555-${Date.now()}`;
const notePath = `${folder}/Inline.md`;

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.waitForFunction(() =>
		(window as any).app.plugins.plugins.tasknotes.initializationComplete === true
	);
	await instance.page.evaluate(async (folder) => {
		const host = (window as any).app;
		const plugin = host.plugins.plugins.tasknotes;
		(window as any).__nlp2555 = {
			data: await plugin.loadData(),
			settings: structuredClone(plugin.settings),
			created: [],
		};
		await host.vault.createFolder(folder);
		await host.vault.create(`${folder}/Admin.md`, '# Admin\n');
	}, folder);
});

test.afterEach(async () => {
	await instance.page.evaluate(async () => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		await plugin.saveData((window as any).__nlp2555.data);
		await plugin.loadSettings(true);
	});
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async (folder) => {
			const host = (window as any).app;
			const state = (window as any).__nlp2555;
			if (state) {
				for (const path of [...state.created, folder]) {
					const file = host.vault.getAbstractFileByPath(path);
					if (file) await host.vault.delete(file, true);
				}
				delete (window as any).__nlp2555;
			}
		}, folder);
	} finally {
		await closeObsidian(instance);
	}
});

async function loadSavedTrigger(project: { trigger: string; enabled: boolean } | null): Promise<void> {
	await instance.page.evaluate(async (project) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const settings = structuredClone((window as any).__nlp2555.settings);
		const triggers = settings.nlpTriggers.triggers
			.filter((trigger: { propertyId: string }) => trigger.propertyId !== 'projects')
			.map((trigger: { propertyId: string }) => trigger.propertyId === 'priority' ? { ...trigger, enabled: true } : trigger);
		if (project) triggers.push({ propertyId: 'projects', ...project });
		await plugin.saveData({
			...settings,
			enableNaturalLanguageInput: true,
			storeTitleInFilename: false,
			taskCreationDefaults: { ...settings.taskCreationDefaults, defaultScheduledDate: 'none', defaultProjects: '' },
			nlpTriggers: { ...settings.nlpTriggers, triggers },
		});
		await plugin.loadSettings(true);
	}, project);
}

async function convert(line: string): Promise<Record<string, any>> {
	await instance.page.evaluate(async ({ notePath, line }) => {
		const host = (window as any).app;
		const state = (window as any).__nlp2555;
		const existing = host.vault.getAbstractFileByPath(notePath);
		if (existing) await host.vault.delete(existing);
		const note = await host.vault.create(notePath, `${line}\n`);
		const leaf = host.workspace.getLeaf(false);
		await leaf.openFile(note, { state: { mode: 'source' } });
		host.workspace.setActiveLeaf(leaf, { focus: true });
		state.before = host.vault.getMarkdownFiles().map((file: { path: string }) => file.path);
		await host.plugins.plugins.tasknotes.instantTaskConvertService.instantConvertTask(host.workspace.activeEditor.editor, 0);
	}, { notePath, line });
	let createdPath: string | null = null;
	await expect.poll(async () => {
		createdPath = await instance.page.evaluate(() => {
			const before = new Set((window as any).__nlp2555.before);
			return (window as any).app.vault.getMarkdownFiles().find((file: { path: string }) => !before.has(file.path))?.path ?? null;
		});
		return createdPath;
	}).not.toBeNull();
	const content = await instance.page.evaluate(async (path) => {
		const host = (window as any).app;
		const state = (window as any).__nlp2555;
		state.created.push(path);
		const file = host.vault.getAbstractFileByPath(path);
		const content = await host.vault.read(file);
		await host.vault.delete(file);
		return content;
	}, createdPath);
	const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	expect(frontmatter).not.toBeNull();
	return parse(frontmatter![1]);
}

for (const [name, project] of [
	['missing', null],
	['empty', { trigger: '', enabled: true }],
	['trailing space', { trigger: '+ ', enabled: true }],
	['leading space', { trigger: ' +', enabled: true }],
] as const) {
	test(`saved ${name} project trigger converts plain and linked projects`, async () => {
		await loadSavedTrigger(project);
		for (const projectText of ['Admin', '[[Admin]]']) {
			const task = await convert(`- [ ] Send Report tomorrow !high +${projectText}`);
			expect(task.title).toBe('Send Report');
			expect(task.priority).toBe('high');
			expect(task.scheduled).toEqual(expect.any(String));
			const projects = await instance.page.evaluate(({ values, source }) => values.map((value: string) => {
				const target = value.replace(/^\[\[(.*)\]\]$/, '$1');
				return (window as any).app.metadataCache.getFirstLinkpathDest(target, source)?.path ?? null;
			}), { values: task.projects, source: notePath });
			expect(projects).toEqual([`${folder}/Admin.md`]);
		}
	});
}

test('a saved disabled project trigger stays literal during conversion', async () => {
	await loadSavedTrigger({ trigger: '+', enabled: false });
	const task = await convert('- [ ] !high Send Report +Admin');
	expect(task.title).toBe('Send Report +Admin');
	expect(task.priority).toBe('high');
	expect(task.projects ?? []).toEqual([]);
});

for (const [input, saved] of [[' + ', '+'], ['  abcdefghij  ', 'abcdefghij']]) {
	test(`native trigger input saves and redisplays ${JSON.stringify(input)} without padding`, async () => {
		await loadSavedTrigger({ trigger: '+', enabled: true });
		let settingsPage = await revealTaskNotesSetting(instance.page, 'nlp.projects.trigger');
		try {
			const inputElement = nativeSettingRow(settingsPage, 'Trigger character:').getByRole('textbox');
			await inputElement.fill(input);
			await inputElement.press('Tab');
			await expect.poll(() => instance.page.evaluate(() =>
				(window as any).app.plugins.plugins.tasknotes.settings.nlpTriggers.triggers.find((trigger: { propertyId: string }) => trigger.propertyId === 'projects')?.trigger
			)).toBe(saved);
			await closeObsidianSettings(instance.page, settingsPage);
			settingsPage = await revealTaskNotesSetting(instance.page, 'nlp.projects.trigger');
			await expect(nativeSettingRow(settingsPage, 'Trigger character:').getByRole('textbox')).toHaveValue(saved);
		} finally {
			await closeObsidianSettings(instance.page, settingsPage);
		}
	});
}
