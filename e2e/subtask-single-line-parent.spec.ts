import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "./obsidian";

/** A parent without metadata renders on one line; its expanded subtasks must keep their own two-line layout. */
let instance: ObsidianApp;
const folder = `E2E single-line parent ${Date.now()}`;

const parentCard = () => instance.page.locator(
	`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/Parent.md"]`
).first();
const childCard = () => parentCard().locator(
	`.task-card__subtasks > .task-card[data-task-path="${folder}/Child.md"]`
);

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.evaluate(async (folder) => {
		const app = (window as any).app;
		const plugin = app.plugins.getPlugin("tasknotes");
		const tag = JSON.stringify(plugin.settings.taskTag);
		await app.vault.createFolder(folder);
		await app.vault.create(`${folder}/Parent.md`, [
			"---", "title: Parent", "status: open", `tags: [${tag}]`, "---", "",
		].join("\n"));
		await app.vault.create(`${folder}/Child.md`, [
			"---", "title: Child", "status: open", "due: 2030-01-15", `tags: [${tag}]`,
			`projects: ["[[${folder}/Parent]]"]`, "---", "",
		].join("\n"));
		const base = await app.vault.create(`${folder}/List.base`, [
			"filters:", "  and:", `    - file.folder == "${folder}"`, '    - file.ext == "md"',
			"views:", "  - type: tasknotesTaskList", "    name: List",
			"    hideTopLevelSubtasks: true", "    order:", "      - note.due", "",
		].join("\n"));
		const leaf = app.workspace.getLeaf("tab");
		await leaf.openFile(base);
		app.workspace.setActiveLeaf(leaf, { focus: true });
	}, folder);
	await expect(parentCard()).toBeVisible();
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async (folder) => {
			const app = (window as any).app;
			for (const leaf of app.workspace.getLeavesOfType("bases")) {
				if (leaf.view.file?.path.startsWith(`${folder}/`)) leaf.detach();
			}
			const directory = app.vault.getAbstractFileByPath(folder);
			if (directory) await app.vault.delete(directory, true);
		}, folder);
	} finally {
		await closeObsidian(instance);
	}
});

test("subtask metadata stays below its title when the parent card has no metadata", async () => {
	// The narrow (stacked) layout applies below 640px; wider lists put every task on one line by design.
	await instance.page.locator(".workspace-leaf.mod-active .tn-tasknotesTaskList").first()
		.evaluate((list) => { (list as HTMLElement).style.width = "460px"; });
	await expect(parentCard()).toHaveClass(/task-card--metadata-empty/);
	await parentCard().getByRole("button", { name: "Expand subtasks", exact: true }).click();
	await expect(childCard()).toBeVisible();
	await expect(childCard()).not.toHaveClass(/task-card--metadata-empty/);

	const title = await childCard().locator(".task-card__title-text").first().boundingBox();
	const metadata = await childCard().locator(".task-card__metadata").first().boundingBox();
	expect(title).not.toBeNull();
	expect(metadata).not.toBeNull();
	expect(metadata!.y).toBeGreaterThanOrEqual(title!.y + title!.height - 1);
});
