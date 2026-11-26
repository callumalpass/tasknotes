import { expect, test } from "@playwright/test";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

let instance: ObsidianApp;
let originalRelationshipsPath: string;
const folder = `E2E issue 2712 ${Date.now()}`;
const parentPath = `${folder}/Parent.md`;
const basePath = `${folder}/relationships.base`;
const children = [
	["Alpha", 10],
	["Bravo", 30],
	["Charlie", 30],
] as const;

function relationshipsBase(sort: boolean): string {
	return [
		"formulas:",
		"  score: if(this.rank == 2, number(rank), -number(rank))",
		"views:",
		"  - type: table",
		"    name: Projects",
		"    filters: 'false'",
		"    sort:",
		"      - property: file.name",
		"        direction: ASC",
		"  - type: table",
		"    name: Subtasks",
		"    filters: list(note.projects).contains(this.file.asLink()) && rank > 10",
		"    limit: 1",
		...(sort
			? [
				"    sort:",
				"      - property: formula.score",
				"        direction: DESC",
				"      - column: file.name",
				"        direction: DESC",
			]
			: []),
		"",
	].join("\n");
}

const paths = (...titles: string[]) => titles.map((title) => `${folder}/${title}.md`);
const configuredOrder = paths("Charlie", "Bravo", "Alpha");
const defaultOrder = paths("Alpha", "Bravo", "Charlie");

test.beforeAll(async () => {
	instance = await launchObsidian();
	originalRelationshipsPath = await instance.page.evaluate(async (fixture) => {
		const app = (window as any).app;
		const plugin = app.plugins.getPlugin("tasknotes");
		await app.vault.createFolder(fixture.folder);
		for (const [title, rank] of [["Parent", 2], ...fixture.children]) {
			await app.vault.create(`${fixture.folder}/${title}.md`, [
				"---",
				`title: ${title}`,
				"status: open",
				"priority: normal",
				`rank: ${rank}`,
				`tags: [${JSON.stringify(plugin.settings.taskTag)}]`,
				...(title === "Parent" ? [] : [`projects: ["[[${fixture.folder}/Parent]]"]`]),
				"---",
				"",
				"Subtask sorting fixture.",
			].join("\n"));
		}
		await app.vault.create(fixture.basePath, fixture.base);
		const previous = plugin.settings.commandFileMapping.relationships;
		plugin.settings.commandFileMapping.relationships = fixture.basePath;
		return previous;
	}, { folder, basePath, children, base: relationshipsBase(true) });

	await expect.poll(() => instance.page.evaluate(async ({ parentPath }) => {
		const app = (window as any).app;
		const plugin = app.plugins.getPlugin("tasknotes");
		return (await plugin.projectSubtasksService.getTasksLinkedToProject(
			app.vault.getAbstractFileByPath(parentPath)
		)).length;
	}, { parentPath })).toBe(children.length);
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async ({ folder, originalRelationshipsPath }) => {
			const app = (window as any).app;
			const plugin = app.plugins.getPlugin("tasknotes");
			plugin.settings.commandFileMapping.relationships = originalRelationshipsPath;
			for (const leaf of app.workspace.getLeavesOfType("markdown")) {
				if (leaf.view.file?.path.startsWith(`${folder}/`)) leaf.detach();
			}
			const fixture = app.vault.getAbstractFileByPath(folder);
			if (fixture) await app.vault.delete(fixture, true);
		}, { folder, originalRelationshipsPath });
	} finally {
		await closeObsidian(instance);
	}
});

test("the Task Edit modal uses the configured Subtasks view sort and falls back when it is removed", async () => {
	const openModal = () => instance.page.evaluate(async (path) => {
		const plugin = (window as any).app.plugins.getPlugin("tasknotes");
		await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(path));
	}, parentPath);
	const rows = instance.page.locator(".modal .task-project-card-host .task-card");
	const rowPaths = () => rows.evaluateAll((cards) => cards.map((card) => card.getAttribute("data-task-path")));

	await openModal();
	await expect.poll(rowPaths).toEqual(configuredOrder);
	await instance.page.keyboard.press("Escape");
	await expect(rows).toHaveCount(0);

	await instance.page.evaluate(async ({ basePath, base }) => {
		const app = (window as any).app;
		await app.vault.modify(app.vault.getAbstractFileByPath(basePath), base);
	}, { basePath, base: relationshipsBase(false) });
	try {
		await openModal();
		await expect.poll(rowPaths).toEqual(defaultOrder);
	} finally {
		await instance.page.keyboard.press("Escape");
		await instance.page.evaluate(async ({ basePath, base }) => {
			const app = (window as any).app;
			await app.vault.modify(app.vault.getAbstractFileByPath(basePath), base);
		}, { basePath, base: relationshipsBase(true) });
	}
});

for (const [mode, label, viewClass] of [
	["preview", "Reading view", "markdown-preview-view"],
	["source", "Live Preview", "markdown-source-view"],
]) {
	test(`the standalone task card in ${label} uses the configured Subtasks view sort`, async () => {
		await instance.page.evaluate(async ({ path, mode }) => {
			const app = (window as any).app;
			const leaf = app.workspace.getLeaf("tab");
			await leaf.openFile(app.vault.getAbstractFileByPath(path), { state: { mode, source: false } });
			app.workspace.setActiveLeaf(leaf, { focus: true });
		}, { path: parentPath, mode });

		const parent = instance.page.locator(
			`.workspace-leaf.mod-active .${viewClass} .task-card-note-widget__card[data-task-path="${parentPath}"]`
		);
		const expand = parent.getByRole("button", { name: "Expand subtasks", exact: true });
		await expect(expand).toBeVisible();
		await expand.click();
		const rows = parent.locator(".task-card__subtasks > .task-card");
		await expect.poll(() => rows.evaluateAll(
			(cards) => cards.map((card) => card.getAttribute("data-task-path"))
		)).toEqual(configuredOrder);
		await parent.getByRole("button", { name: "Collapse subtasks", exact: true }).click();
	});
}
