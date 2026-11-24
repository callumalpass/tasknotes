import { expect, test, type Locator } from "@playwright/test";
import { stringify } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const folder = `Issue 2688 date colours ${Date.now()}`;
let instance: ObsidianApp;

test.beforeAll(async () => {
	instance = await launchObsidian();
	const filters = { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] };
	const views = [
		{ type: "tasknotesKanban", name: "Kanban", groupBy: { property: "status", direction: "ASC" } },
		{ type: "tasknotesTaskList", name: "Task List" },
	];
	const bases = views.map((view) => ({
		filename: `${view.name}.base`,
		content: stringify({ filters, views: [{ ...view, order: ["scheduled", "due"] }] }),
	}));

	await instance.page.evaluate(async ({ folder, bases }) => {
		const { vault } = (window as any).app;
		const today = new Date();
		const past = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2, 12);
		const dateOnly = (date: Date) => date.toLocaleDateString("sv-SE");
		await vault.createFolder(folder);
		await vault.create(
			`${folder}/Past dates.md`,
			`---\ntags: [task]\nstatus: open\nscheduled: ${dateOnly(past)}\ndue: ${dateOnly(past)}\n---\n`,
		);
		await vault.create(
			`${folder}/Scheduled today control.md`,
			`---\ntags: [task]\nstatus: open\nscheduled: ${dateOnly(today)}\n---\n`,
		);
		await vault.create(`${folder}/Inline.md`, "[[Past dates]]\n\n[[Scheduled today control]]\n");
		for (const { filename, content } of bases) {
			await vault.create(`${folder}/${filename}`, content);
		}
	}, { folder, bases });
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async (folder) => {
			const { vault } = (window as any).app;
			const fixture = vault.getAbstractFileByPath(folder);
			if (fixture) await vault.delete(fixture, true);
		}, folder);
	} finally {
		await closeObsidian(instance);
	}
});

async function resolveColour(date: Locator, value: string, property = "color") {
	return date.evaluate((element, { value, property }) => {
		const probe = document.createElement("span");
		probe.style.setProperty(property, value);
		element.appendChild(probe);
		const colour = getComputedStyle(probe).getPropertyValue(property);
		probe.remove();
		return colour;
	}, { value, property });
}

for (const filename of ["Kanban.base", "Task List.base", "Inline.md"]) {
	test(`scheduled and due date colours in ${filename}`, async () => {
		const { page } = instance;
		await page.evaluate(async (path) => {
			const { vault, workspace } = (window as any).app;
			await workspace.getLeaf(false).openFile(vault.getAbstractFileByPath(path), {
				state: { mode: "preview" },
			});
		}, `${folder}/${filename}`);

		const root = page.locator(".workspace-leaf.mod-active");
		const cards = root.locator(filename === "Inline.md" ? ".task-card--layout-inline:visible" : ".task-card:visible");
		const title = page.locator(".task-card__title-text");
		const pastCard = cards.filter({ has: title.filter({ hasText: /^Past dates$/ }) });
		const scheduled = pastCard.locator(".task-card__metadata-date--past");
		const due = pastCard.locator(".task-card__metadata-date--overdue");
		const today = cards
			.filter({ has: title.filter({ hasText: /^Scheduled today control$/ }) })
			.locator(".task-card__metadata-date--scheduled.task-card__metadata-date--today");
		await expect(scheduled).toBeVisible();
		await expect(due).toBeVisible();
		await expect(today).toBeVisible();
		const blue = await resolveColour(scheduled, "var(--tn-info-text, var(--tn-info))");
		const red = await resolveColour(due, "var(--tn-danger-text)");
		const hover = await resolveColour(scheduled, "var(--tn-hover)", "background-color");
		await expect(scheduled).toHaveCSS("color", blue);
		await expect(due).toHaveCSS("color", red);
		await expect(today).not.toHaveCSS("color", blue);
		await expect(due.locator(".task-card__date-icon")).toHaveCSS("color", red);
		await scheduled.hover();
		await expect(scheduled).toHaveCSS("background-color", hover);
		await expect(scheduled).toHaveCSS("color", blue);
		await expect(scheduled.locator(".task-card__date-icon")).toHaveCSS("color", blue);
	});
}
