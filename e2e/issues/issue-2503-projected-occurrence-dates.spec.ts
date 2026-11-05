import { test, expect, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const root = `Projected occurrence dates ${Date.now()}`;
let instance: ObsidianApp;
let page: Page;

function localDate(offsetDays = 0): string {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shortDate(date: string): string {
	return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

const nextOccurrence = localDate(3);
const projectedOccurrence = localDate(10);
const due = localDate(5);
const rule = `DTSTART:${nextOccurrence.replaceAll("-", "")};FREQ=WEEKLY`;
const taskPath = (name: string) => `${root}/${name}.md`;

function card(name: string, eventType: "scheduled" | "recurring"): Locator {
	return page
		.locator(
			`.workspace-leaf.mod-active [data-event-type="${eventType}"] .task-card[data-task-path="${taskPath(name)}"]`
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

async function agendaWithRecurringTask(name: string, extraYaml = ""): Promise<void> {
	await page.evaluate(
		async ({ root, path, name, nextOccurrence, rule, extraYaml }) => {
			const app = (window as any).app;
			await app.vault.create(
				path,
				`---\ntags: [task]\ntitle: ${name}\nstatus: open\npriority: normal\nscheduled: ${nextOccurrence}\n${extraYaml}recurrence: "${rule}"\n---\n`
			);
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const base = await app.vault.create(
				`${root}/${name}.base`,
				`filters:\n  and:\n    - file.inFolder("${root}")\n    - file.name == "${name}"\nviews:\n  - type: tasknotesCalendar\n    name: Agenda\n    calendarView: listWeek\n    listDayCount: 14\n    order:\n      - status\n      - scheduled\n      - due\n`
			);
			await app.workspace.getLeaf("tab").openFile(base);
		},
		{ root, path: taskPath(name), name, nextOccurrence, rule, extraYaml }
	);
	await expect(card(name, "recurring")).toBeVisible();
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

test("a projected occurrence shows its own date and its chip cannot edit the series", async () => {
	await agendaWithRecurringTask("Weekly review");

	const projected = card("Weekly review", "recurring");
	const chip = projected.locator(".task-card__metadata-date--scheduled");
	await expect(chip).toContainText(shortDate(projectedOccurrence));
	await expect(chip).not.toHaveAttribute("data-tn-action", "edit-date");

	// The click reaches the card, as anywhere else on it, not a date menu.
	await chip.click({ force: true });
	await expect(page.locator(".modal-container")).toBeVisible();
	await expect(page.getByText("Tomorrow", { exact: true })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(page.locator(".modal-container")).toHaveCount(0);
	expect((await frontmatter("Weekly review")).scheduled).toBe(nextOccurrence);

	// Control: the pending occurrence's chip still moves it.
	const pending = card("Weekly review", "scheduled");
	await expect(pending.locator(".task-card__metadata-date--scheduled")).toContainText(
		shortDate(nextOccurrence)
	);
	await pending.locator(".task-card__metadata-date--scheduled").click();
	await page.getByText("Tomorrow", { exact: true }).click();
	await expect.poll(async () => (await frontmatter("Weekly review")).scheduled).toBe(localDate(1));
});

test("a timed daily series with matching dates does not look overdue on later rows", async () => {
	const start = localDate(-1);
	const name = "Timed daily";
	await page.evaluate(
		async ({ root, path, name, start }) => {
			const app = (window as any).app;
			await app.vault.create(
				path,
				`---\ntags: [task]\ntitle: ${name}\nstatus: open\npriority: normal\nscheduled: ${start}T19:00\ndue: ${start}T19:00\nrecurrence: "DTSTART:${start.replaceAll("-", "")}T190000;FREQ=DAILY;COUNT=5"\n---\n`
			);
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const base = await app.vault.create(
				`${root}/${name}.base`,
				`filters:\n  and:\n    - file.inFolder("${root}")\n    - file.name == "${name}"\nviews:\n  - type: tasknotesCalendar\n    name: Agenda\n    calendarView: listWeek\n    listDayCount: 7\n    initialDate: ${start}\n    showDue: false\n    order:\n      - status\n      - scheduled\n      - due\n`
			);
			await app.workspace.getLeaf("tab").openFile(base);
		},
		{ root, path: taskPath(name), name, start }
	);
	await expect(card(name, "recurring")).toBeVisible();

	const rows = page.locator(
		`.workspace-leaf.mod-active [data-event-type="recurring"] .task-card[data-task-path="${taskPath(name)}"]`
	);
	await expect(rows).toHaveCount(4);
	for (const [index, offset] of [[1, 1], [2, 2], [3, 3]]) {
		const row = rows.nth(index);
		await expect(row.locator(".task-card__metadata-date--scheduled")).toContainText(
			shortDate(localDate(offset))
		);
		await expect(row.locator(".task-card__metadata-date--scheduled")).toContainText(/19:00|7:00/);
		await expect(row.locator(".task-card__metadata-date--past")).toHaveCount(0);
		await expect(row.locator(".task-card__metadata-date--overdue")).toHaveCount(0);
		await expect(row.locator(".task-card__metadata-date--due")).toHaveCount(0);
	}

	// Control: the pending occurrence really is overdue.
	await expect(card(name, "scheduled").locator(".task-card__metadata-date--overdue")).toBeVisible();
});

test("a projected occurrence leaves out the series' due date", async () => {
	await agendaWithRecurringTask("Due series", `due: ${due}\n`);

	await expect(card("Due series", "recurring").locator(".task-card__metadata-date--due")).toHaveCount(0);
	await expect(card("Due series", "scheduled").locator(".task-card__metadata-date--due")).toContainText(
		shortDate(due)
	);
});
