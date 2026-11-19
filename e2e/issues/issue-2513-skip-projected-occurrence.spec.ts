import { test, expect, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const root = `Skip projected occurrence ${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

function localDate(offsetDays = 0): string {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const nextOccurrence = localDate(3);
const projectedOccurrence = localDate(10);
const rule = `DTSTART:${nextOccurrence.replaceAll("-", "")};FREQ=WEEKLY`;
const taskPath = (name: string) => `${root}/${name}.md`;

function projectedCard(name: string): Locator {
	return page
		.locator(
			`.workspace-leaf.mod-active [data-event-type="recurring"] .task-card[data-task-path="${taskPath(name)}"]`
		)
		.first();
}

async function frontmatter(name: string): Promise<Record<string, any>> {
	const text = await page.evaluate(async (path) => {
		const app = (window as any).app;
		return app.vault.read(app.vault.getAbstractFileByPath(path));
	}, taskPath(name));
	return parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
}

async function agendaWithRecurringTask(name: string): Promise<void> {
	await page.evaluate(
		async ({ root, path, name, nextOccurrence, rule }) => {
			const app = (window as any).app;
			await app.vault.create(
				path,
				`---\ntags: [task]\ntitle: ${name}\nstatus: open\npriority: normal\nscheduled: ${nextOccurrence}\nrecurrence: "${rule}"\n---\n`
			);
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const base = await app.vault.create(
				`${root}/${name}.base`,
				`filters:\n  and:\n    - file.inFolder("${root}")\n    - file.name == "${name}"\nviews:\n  - type: tasknotesCalendar\n    name: Agenda\n    calendarView: listWeek\n    listDayCount: 14\n    order:\n      - status\n      - scheduled\n`
			);
			await app.workspace.getLeaf("tab").openFile(base);
		},
		{ root, path: taskPath(name), name, nextOccurrence, rule }
	);
	await expect(projectedCard(name)).toBeVisible();
}

async function chooseSkip(): Promise<void> {
	await page.locator(".menu-item", { hasText: "Mark complete or skip" }).hover();
	await page.locator(".menu-item", { hasText: "Skip instance" }).click();
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	page = instance.page;
	await page.evaluate(async (root) => {
		const app = (window as any).app;
		await app.vault.createFolder(root);
		app.workspace.leftSplit.collapse();
		app.workspace.rightSplit.collapse();
	}, root);
});

test.afterAll(async () => {
	try {
		if (page && !page.isClosed()) {
			await page.evaluate(async (root) => {
				const app = (window as any).app;
				for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
				await app.vault.delete(app.vault.getAbstractFileByPath(root), true);
			}, root);
		}
	} finally {
		if (instance) await closeObsidian(instance);
	}
});

test("Skip in the card's options menu skips that row's occurrence", async () => {
	await agendaWithRecurringTask("Options menu");
	await projectedCard("Options menu").locator(".task-card__context-menu").click();
	await chooseSkip();

	await expect.poll(async () => (await frontmatter("Options menu")).skipped_instances).toEqual([
		projectedOccurrence,
	]);
});

test("Skip from right-clicking the card skips that row's occurrence", async () => {
	await agendaWithRecurringTask("Right click");
	await projectedCard("Right click").click({ button: "right" });
	await chooseSkip();

	await expect.poll(async () => (await frontmatter("Right click")).skipped_instances).toEqual([
		projectedOccurrence,
	]);
});
