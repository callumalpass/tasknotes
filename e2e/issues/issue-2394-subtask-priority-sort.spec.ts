import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

/** #2394: an unchanged parent row must not retain an obsolete child sort order. */
let instance: ObsidianApp;
const folder = `E2E issue 2394 ${Date.now()}`;

const parentCard = () => instance.page.locator(
	`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/Parent.md"]`
).first();
const childPaths = () => parentCard().locator(".task-card__subtasks > .task-card")
	.evaluateAll((cards) => cards.map((card) => card.getAttribute("data-task-path")));

async function changeDirection(from: string, to: string): Promise<void> {
	await instance.page.getByRole("button", { name: "Sort", exact: true }).click();
	await instance.page.getByText(from, { exact: true }).click();
	await instance.page.getByText(to, { exact: true }).last().click();
	await instance.page.keyboard.press("Escape");
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.evaluate(async (folder) => {
		const app = (window as any).app;
		const plugin = app.plugins.getPlugin("tasknotes");
		await app.vault.createFolder(folder);
		for (const [title, priority] of [
			["Parent", "normal"], ["A-low", "low"], ["B-high", "high"], ["C-normal", "normal"],
		]) {
			await app.vault.create(`${folder}/${title}.md`, [
				"---", `title: ${title}`, "status: open", `priority: ${priority}`,
				`tags: [${JSON.stringify(plugin.settings.taskTag)}]`,
				...(title === "Parent" ? [] : [`projects: ["[[${folder}/Parent]]"]`]),
				"---", "",
			].join("\n"));
		}
		const base = await app.vault.create(`${folder}/Priority.base`, [
			"filters:", "  and:", `    - file.folder == "${folder}"`,
			'    - file.ext == "md"', "formulas:",
			'  priorityWeight: if(priority=="high",3,if(priority=="normal",2,if(priority=="low",1,0)))',
			"views:", "  - type: tasknotesTaskList", "    name: Priority",
			"    hideTopLevelSubtasks: true", "    order:", "      - note.priority",
			"    sort:", "      - property: formula.priorityWeight", "        direction: DESC", "",
		].join("\n"));
		await app.workspace.getLeaf("tab").openFile(base);
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

test("expanded subtasks refresh on priorityWeight sort changes without toggling the parent", async () => {
	await parentCard().getByRole("button", { name: "Expand subtasks", exact: true }).click();
	await expect.poll(childPaths).toEqual([
		`${folder}/B-high.md`, `${folder}/C-normal.md`, `${folder}/A-low.md`,
	]);

	await changeDirection("1 → 0", "0 → 1");
	await expect.poll(childPaths).toEqual([
		`${folder}/A-low.md`, `${folder}/C-normal.md`, `${folder}/B-high.md`,
	]);
	await expect(parentCard().getByRole("button", { name: "Collapse subtasks", exact: true }))
		.toBeVisible();

	await changeDirection("0 → 1", "1 → 0");
	await expect.poll(childPaths).toEqual([
		`${folder}/B-high.md`, `${folder}/C-normal.md`, `${folder}/A-low.md`,
	]);
});
