/**
 * Issue #2594: Obsidian froze when a note showed an Agenda in a ```base code block.
 *
 * The code block was not recognised as embedded, so the calendar kept "fill" height
 * (the default). The note gives the block no height, so the agenda's end stayed in
 * view and it kept loading more days, re-rendering every task each time, until the
 * renderer hung. It now sizes to its content, like a ![[file.base]] embed.
 *
 * The fixture is the reporter's Base.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2594
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { launchObsidian, closeObsidian, ObsidianApp } from "../obsidian";

const BASE_SOURCE = fs.readFileSync(path.join(__dirname, "../fixtures/issue-2594-agenda.base"), "utf8");
const NOTE = "Issue 2594 agenda host.md";
const TASKS = Array.from({ length: 4 }, (_, i) => `TaskNotes/Issue 2594 daily ${i}.md`);

let app: ObsidianApp;

test.beforeAll(async () => {
	app = await launchObsidian();
});

test.afterAll(async () => {
	if (app) await closeObsidian(app);
});

test("an Agenda in a base code block keeps a stable height (#2594)", async () => {
	const page = app.page;
	await page.evaluate(
		async ({ note, tasks, base }) => {
			const vault = (window as any).app.vault;
			const today = (window as any).moment().format("YYYY-MM-DD");
			for (const p of [note, ...tasks]) {
				const existing = vault.getAbstractFileByPath(p);
				if (existing) await vault.delete(existing);
			}
			for (const [i, task] of tasks.entries()) {
				await vault.create(
					task,
					`---\ntitle: Issue 2594 daily ${i}\nstatus: open\npriority: normal\nscheduled: ${today}\nrecurrence: "DTSTART:${today.replace(/-/g, "")};FREQ=DAILY"\ntags:\n  - task\n---\n`
				);
			}
			await vault.create(note, `Daily note text\n\n\`\`\`base\n${base}\`\`\`\n`);
			await (window as any).app.workspace.getLeaf(true).openFile(vault.getAbstractFileByPath(note));
		},
		{ note: NOTE, tasks: TASKS, base: BASE_SOURCE }
	);

	try {
		const calendar = page.locator(".block-language-base .advanced-calendar-view");
		await expect(calendar.locator(".tnc-item", { hasText: "Issue 2594 daily 0" }).first()).toBeVisible({ timeout: 20_000 });
		await expect(calendar).toHaveClass(/advanced-calendar-view--auto-height/);

		// The agenda loads a little ahead of the viewport, then stops. Before the fix
		// it kept growing by thousands of pixels a second until the renderer hung.
		const height = () => calendar.evaluate((el) => Math.round(el.getBoundingClientRect().height));
		let settled = 0;
		await expect
			.poll(async () => {
				const before = await height();
				await page.waitForTimeout(1000);
				settled = await height();
				return settled === before;
			}, { timeout: 15_000 })
			.toBe(true);
		expect(settled).toBeLessThan(5000);
		await page.waitForTimeout(2000);
		expect(await height()).toBe(settled);
	} finally {
		await page.evaluate(
			async (paths) => {
				const w = window as any;
				w.app.workspace.getMostRecentLeaf()?.detach();
				for (const p of paths) {
					const file = w.app.vault.getAbstractFileByPath(p);
					if (file) await w.app.vault.delete(file);
				}
			},
			[NOTE, ...TASKS]
		);
	}
});
