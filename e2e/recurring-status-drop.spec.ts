import { test, expect, type CDPSession, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "./obsidian";

const root = `Recurring status drop ${Date.now()}`;
let folder = root;
let instance: ObsidianApp;
let page: Page;

function localDate(offsetDays = 0): string {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const today = localDate();
const inTwoDays = localDate(2);
const nextWeek = localDate(7);
const rule = `DTSTART:${today.replaceAll("-", "")};FREQ=WEEKLY`;

const taskPath = (name: string) => `${folder}/${name}.md`;
const card = (name: string): Locator =>
	page.locator(`.workspace-leaf.mod-active [data-task-path="${taskPath(name)}"]`).first();
const column = (key: string): Locator =>
	page.locator(`.workspace-leaf.mod-active .kanban-view__column[data-group="${key}"]`);
const notice = (name: string): Locator => page.locator(".notice").filter({ hasText: name });

async function yaml(name: string): Promise<Record<string, any>> {
	const text = await page.evaluate(async (path) => {
		const app = (window as any).app;
		return app.vault.read(app.vault.getAbstractFileByPath(path));
	}, taskPath(name));
	return parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
}

async function createTask(name: string, fields: Record<string, unknown>): Promise<void> {
	await page.evaluate(
		async ({ path, name, fields }) => {
			const lines = Object.entries({ title: name, priority: "normal", ...fields }).map(
				([key, value]) => `${key}: ${JSON.stringify(value)}`
			);
			await (window as any).app.vault.create(
				path,
				`---\ntags: [task]\n${lines.join("\n")}\n---\n`
			);
		},
		{ path: taskPath(name), name, fields }
	);
}

async function openBase(view: string): Promise<void> {
	await page.evaluate(
		async ({ folder, view }) => {
			const app = (window as any).app;
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const content = `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n${view}`;
			const file = await app.vault.create(`${folder}/View.base`, content);
			await app.workspace.getLeaf("tab").openFile(file);
		},
		{ folder, view }
	);
}

const board = `  - type: tasknotesKanban\n    name: Board\n    groupBy:\n      property: status\n      direction: ASC\n    columnWidth: 280\n`;
const list = `  - type: tasknotesTaskList\n    name: List\n    groupBy:\n      property: status\n      direction: ASC\n`;

async function pickUp(source: Locator): Promise<{ x: number; y: number }> {
	const box = (await source.boundingBox())!;
	const start = { x: box.x + box.width / 2, y: box.y + 20 };
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x + 12, start.y, { steps: 4 });
	return start;
}

async function dropOn(target: Locator): Promise<void> {
	const box = (await target.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + 40, { steps: 25 });
	await page.mouse.up();
}

async function dragToDone(name: string): Promise<void> {
	await pickUp(card(name));
	await dropOn(column("done"));
}

/** The native operation starts by resolving its date, so this runs after a drop's check and before that operation reads fresh state. */
async function interleaveBeforeNativeRead(change: "complete" | "skip" | "reschedule"): Promise<void> {
	await page.evaluate(
		({ change, inTwoDays }) => {
			const service = (window as any).app.plugins.plugins.tasknotes.taskService;
			const resolve = service.resolveRecurringTaskActionDate.bind(service);
			service.resolveRecurringTaskActionDate = async (task: unknown, date?: Date) => {
				service.resolveRecurringTaskActionDate = resolve;
				if (change === "complete") await service.toggleRecurringTaskComplete(task, date);
				if (change === "skip") await service.toggleRecurringTaskSkipped(task, date);
				if (change === "reschedule") await service.updateProperty(task, "scheduled", inTwoDays);
				return resolve(task, date);
			};
		},
		{ change, inTwoDays }
	);
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

test.beforeEach(async () => {
	folder = `${root}/${Date.now()}`;
	await page.evaluate(async (folder) => {
		await (window as any).app.vault.createFolder(folder);
		document.querySelectorAll(".notice").forEach((notice) => notice.remove());
	}, folder);
	await createTask("Weekly", { status: "open", scheduled: today, recurrence: rule });
	await createTask("Finished", { status: "done", scheduled: today, completedDate: today });
});

test.afterAll(async () => {
	try {
		if (page && !page.isClosed()) {
			await page.evaluate(async (root) => {
				const app = (window as any).app;
				for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
				const fixture = app.vault.getAbstractFileByPath(root);
				if (fixture) await app.vault.delete(fixture, true);
			}, root);
		}
	} finally {
		if (instance) await closeObsidian(instance);
	}
});

test("a mouse drop on Done completes the occurrence, and Undo restores it", async () => {
	await openBase(board);
	await expect(card("Weekly")).toBeVisible();

	await dragToDone("Weekly");

	await expect.poll(async () => (await yaml("Weekly")).complete_instances).toEqual([today]);
	const completed = await yaml("Weekly");
	expect(completed.status).toBe("open");
	expect(completed.scheduled).toBe(nextWeek);
	expect(completed.completedDate).toBeUndefined();
	await expect(notice("Weekly")).toContainText("Next:");

	await notice("Weekly").getByRole("button", { name: "Undo", exact: true }).click();

	await expect.poll(async () => (await yaml("Weekly")).scheduled).toBe(today);
	expect((await yaml("Weekly")).complete_instances ?? []).toEqual([]);
});

test("a drop acting on an occurrence finished mid-drag changes nothing", async () => {
	await openBase(board);
	await expect(card("Weekly")).toBeVisible();

	await pickUp(card("Weekly"));
	await page.evaluate(async (path) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		await plugin.taskService.toggleRecurringTaskComplete(
			await plugin.cacheManager.getTaskInfo(path)
		);
	}, taskPath("Weekly"));
	await expect.poll(async () => (await yaml("Weekly")).scheduled).toBe(nextWeek);
	await dropOn(column("done"));

	await page.waitForTimeout(1500);
	const settled = await yaml("Weekly");
	expect(settled.complete_instances).toEqual([today]);
	expect(settled.scheduled).toBe(nextWeek);
	expect(settled.status).toBe("open");
	await expect(column("done").locator(`[data-task-path="${taskPath("Weekly")}"]`)).toHaveCount(0);
});

test("a completion landing after the drop's check cannot reopen the occurrence", async () => {
	await openBase(board);
	await expect(card("Weekly")).toBeVisible();
	await interleaveBeforeNativeRead("complete");

	await dragToDone("Weekly");

	await expect.poll(async () => (await yaml("Weekly")).complete_instances).toEqual([today]);
	await page.waitForTimeout(1500);
	const settled = await yaml("Weekly");
	expect(settled.complete_instances).toEqual([today]);
	expect(settled.scheduled).toBe(nextWeek);
	expect(settled.status).toBe("open");
	await expect(notice("Marked incomplete")).toHaveCount(0);
});

test("a skip landing after the drop's check keeps the occurrence skipped", async () => {
	await openBase(board);
	await expect(card("Weekly")).toBeVisible();
	await interleaveBeforeNativeRead("skip");

	await dragToDone("Weekly");

	await expect.poll(async () => (await yaml("Weekly")).skipped_instances).toEqual([today]);
	await page.waitForTimeout(1500);
	const settled = await yaml("Weekly");
	expect(settled.skipped_instances).toEqual([today]);
	expect(settled.complete_instances ?? []).toEqual([]);
	expect(settled.scheduled).toBe(nextWeek);
});

test("a reschedule landing after the drop's check keeps the new placement", async () => {
	await openBase(board);
	await expect(card("Weekly")).toBeVisible();
	await interleaveBeforeNativeRead("reschedule");

	await dragToDone("Weekly");

	await expect.poll(async () => (await yaml("Weekly")).scheduled).toBe(inTwoDays);
	await page.waitForTimeout(1500);
	const settled = await yaml("Weekly");
	expect(settled.scheduled).toBe(inTwoDays);
	expect(settled.complete_instances ?? []).toEqual([]);
});

test("a touch drop on Done completes the occurrence", async () => {
	const session: CDPSession = await page.context().newCDPSession(page);
	await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 10 });
	try {
		await openBase(board);
		await expect(card("Weekly")).toBeVisible();
		const from = (await card("Weekly").boundingBox())!;
		const to = (await column("done").boundingBox())!;
		const x = from.x + from.width / 2;
		const y = from.y + 20;

		await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
		await expect(card("Weekly")).toHaveClass(/kanban-view__touch-drag-source/);
		for (let step = 1; step <= 15; step++) {
			await session.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [
					{
						x: x + ((to.x + to.width / 2 - x) * step) / 15,
						y: y + ((to.y + 40 - y) * step) / 15,
					},
				],
			});
		}
		await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

		await expect.poll(async () => (await yaml("Weekly")).complete_instances).toEqual([today]);
		expect((await yaml("Weekly")).status).toBe("open");
	} finally {
		await session.send("Emulation.setTouchEmulationEnabled", { enabled: false });
		await session.detach();
	}
});

test("a Task List move to Done completes the occurrence", async () => {
	await openBase(list);
	await expect(card("Weekly")).toBeVisible();

	await card("Weekly").dragTo(
		page.locator('.workspace-leaf.mod-active .task-group[data-level="primary"][data-group-key="done"]')
	);

	await expect.poll(async () => (await yaml("Weekly")).complete_instances).toEqual([today]);
	expect((await yaml("Weekly")).status).toBe("open");
});

test("ordinary tasks and moves between open statuses write status as before", async () => {
	await createTask("Ordinary", { status: "open", scheduled: today });
	await createTask("Started", { status: "in-progress", scheduled: today });
	await openBase(board);
	await expect(card("Ordinary")).toBeVisible();

	await dragToDone("Ordinary");
	await expect.poll(async () => (await yaml("Ordinary")).status).toBe("done");
	expect((await yaml("Ordinary")).completedDate).toBe(today);

	await pickUp(card("Weekly"));
	await dropOn(column("in-progress"));
	await expect.poll(async () => (await yaml("Weekly")).status).toBe("in-progress");
	expect((await yaml("Weekly")).complete_instances ?? []).toEqual([]);
	expect((await yaml("Weekly")).scheduled).toBe(today);
});
