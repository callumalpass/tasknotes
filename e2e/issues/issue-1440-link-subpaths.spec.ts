import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

/** #1440: project links with a heading or block subpath open the note at that target. */
let instance: ObsidianApp;
const folder = `E2E issue 1440 ${Date.now()}`;
const project = `${folder}/Project Note.md`;

const filler = Array.from({ length: 300 }, (_, i) => `Filler line ${i + 1}`);
const projectBody = [
	"# Top", ...filler, "## Deep heading", "Heading body", ...filler,
	"", "Block target text ^blk1440", "", ...filler,
].join("\n");

const projectLink = (task: string) => instance.page.locator(
	`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/${task}.md"] .task-card__project-link`
).first();

async function openTaskList(): Promise<void> {
	await instance.page.evaluate(async (folder) => {
		const app = (window as any).app;
		const leaf = app.workspace.getLeaf("tab");
		await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Tasks.base`));
		app.workspace.setActiveLeaf(leaf, { focus: true });
	}, folder);
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.evaluate(async ({ folder, project, projectBody }) => {
		const app = (window as any).app;
		const plugin = app.plugins.getPlugin("tasknotes");
		await app.vault.createFolder(folder);
		await app.vault.create(project, projectBody);
		const tasks: Array<[string, string]> = [
			["Heading task", `"[[Project Note#Deep heading]]"`],
			["Block task", `"[Project](<Project%20Note.md#^blk1440>)"`],
		];
		for (const [title, link] of tasks) {
			await app.vault.create(`${folder}/${title}.md`, [
				"---", `title: ${title}`, "status: open", "priority: normal",
				`tags: [${JSON.stringify(plugin.settings.taskTag)}]`, `projects: [${link}]`, "---", "",
			].join("\n"));
		}
		await app.vault.create(`${folder}/Tasks.base`, [
			"filters:", "  and:", `    - file.folder == "${folder}"`, "    - file.hasTag(\"task\")",
			"views:", "  - type: tasknotesTaskList", "    name: Tasks", "    order:",
			"      - note.projects", "",
		].join("\n"));
	}, { folder, project, projectBody });
	// Block links resolve through the metadata cache, so wait until the block is indexed.
	await expect.poll(() => instance.page.evaluate((project) => {
		const app = (window as any).app;
		return Boolean(app.metadataCache.getCache(project)?.blocks?.blk1440);
	}, project)).toBe(true);
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async (folder) => {
			const app = (window as any).app;
			app.workspace.iterateRootLeaves((leaf: any) => {
				if (leaf.view.file?.path.startsWith(`${folder}/`)) leaf.detach();
			});
			const directory = app.vault.getAbstractFileByPath(folder);
			if (directory) await app.vault.delete(directory, true);
		}, folder);
	} finally {
		await closeObsidian(instance);
	}
});

for (const [task, target] of [
	["Heading task", "Deep heading"],
	["Block task", "Block target text"],
] as const) {
	test(`${task} opens the project note at its subpath`, async () => {
		await openTaskList();
		await expect(projectLink(task)).toBeVisible();
		await projectLink(task).click();

		await expect.poll(() => instance.page.evaluate(
			() => (window as any).app.workspace.getActiveFile()?.path
		)).toBe(project);
		const line = instance.page.locator(".workspace-leaf.mod-active .markdown-source-view .cm-line", {
			hasText: target,
		}).first();
		await expect(line).toBeInViewport();
		await expect(instance.page.locator(".workspace-leaf.mod-active .cm-line", {
			hasText: "Top",
		})).not.toBeInViewport();
	});
}
