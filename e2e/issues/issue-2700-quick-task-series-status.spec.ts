import { expect, test } from "@playwright/test";
import { parse } from "yaml";
import { closeObsidian, launchObsidian, runCommand } from "../obsidian";

const folder = `Issue 2700 ${Date.now()}`;
const query = "Issue 2700 recurring status";
const seriesPath = `${folder}/${query} A.md`;
const openPath = `${folder}/${query} B.md`;
const basePath = `${folder}/Tasks.base`;
const completedDate = "2026-11-19";
const nextDate = "2026-11-20";
const droppedColor = "#a854c4";
const completedClass = /(?:^|\s)task-card--completed(?:\s|$)/;

test("the open-task picker shows the series status and the tracking picker shows occurrence status", async ({}, testInfo) => {
	const instance = await launchObsidian();
	const { page } = instance;
	const card = (path: string) => page.locator(`.task-card[data-task-path="${path}"]`);
	const statusDot = (path: string) => card(path).locator(".task-card__status-dot");
	const picker = page.locator(".task-selector-with-create-modal");
	const suggestion = (path: string) => picker.locator(card(path));
	const readSeries = async () => {
		const content = await page.evaluate(async (path) => {
			const vault = (window as any).app.vault;
			return vault.read(vault.getAbstractFileByPath(path)) as Promise<string>;
		}, seriesPath);
		return parse(content.split("---")[1]);
	};
	const openPicker = async (command: string) => {
		await runCommand(page, command);
		await picker.locator(".prompt-input").fill(query);
		await expect(suggestion(seriesPath)).toBeVisible();
	};

	try {
		const cdp = await page.context().newCDPSession(page);
		await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "UTC" });
		await page.clock.setFixedTime(new Date("2026-11-19T12:00:00Z"));
		await page.evaluate(async ({ folder, seriesPath, openPath, basePath, completedDate, droppedColor }) => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins.tasknotes;
			plugin.settings.resetRecurringStatusAfterOccurrence = false;
			plugin.settings.customStatuses.push({
				id: "dropped",
				value: "dropped",
				label: "Dropped",
				color: droppedColor,
				order: plugin.settings.customStatuses.length,
				isCompleted: true,
				autoArchive: false,
				autoArchiveDelay: 5,
			});
			plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
			await app.vault.createFolder(folder);
			const openTask = "tags: [task]\nstatus: open\npriority: normal\n";
			await app.vault.create(seriesPath, `---\n${openTask}scheduled: ${completedDate}\nrecurrence: DTSTART:20261119;FREQ=DAILY\nrecurrence_anchor: scheduled\n---\n`);
			await app.vault.create(openPath, `---\n${openTask}---\n`);
			const base = await app.vault.create(basePath, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: Tasks\n    order: [status]\n`);
			await app.workspace.getLeaf(false).openFile(base);
		}, { folder, seriesPath, openPath, basePath, completedDate, droppedColor });

		await test.step("Complete an occurrence and set Series status to Dropped in Bases", async () => {
			await statusDot(seriesPath).click();
			await expect.poll(readSeries).toMatchObject({
				status: "open",
				scheduled: nextDate,
				complete_instances: [completedDate],
			});
			await card(seriesPath).click({ button: "right" });
			await page.locator(".menu-item-title").getByText("Series status", { exact: true }).click();
			const input = page.locator(".tn-picker__input");
			await input.fill("Dropped");
			await input.press("Enter");
			await expect.poll(readSeries).toMatchObject({
				status: "dropped",
				scheduled: nextDate,
				complete_instances: [completedDate],
			});
			await expect(card(seriesPath)).toHaveAttribute("data-status", "dropped");
			await expect(statusDot(seriesPath)).toHaveAttribute("aria-label", "Dropped");
			await expect(card(seriesPath)).not.toHaveClass(completedClass);
		});

		for (const [day, occurrenceStatus] of [[19, "done"], [20, "open"]] as const) {
			await test.step(`Compare the pickers on November ${day}`, async () => {
				await page.clock.setFixedTime(new Date(`2026-11-${day}T12:00:00Z`));
				await openPicker("Create or open task and start time tracking");
				await expect(suggestion(seriesPath)).toHaveAttribute("data-status", occurrenceStatus);
				await page.keyboard.press("Escape");
				await expect(picker).toBeHidden();

				await openPicker("Create or open task");
				await testInfo.attach(`Open-task picker on November ${day}`, {
					body: await picker.screenshot(),
					contentType: "image/png",
				});
				const series = suggestion(seriesPath);
				await expect(series).toHaveAttribute("data-status", "dropped");
				await expect(series.locator(".task-card__status-dot")).toHaveAttribute("aria-label", "Dropped");
				expect(await series.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--current-status-color"))).toBe(droppedColor);
				await expect(series).toHaveClass(completedClass);
				await expect(picker.locator(".task-selector-modal__suggestion").first()).toHaveAttribute("data-task-path", openPath);
				await expect(suggestion(openPath)).toHaveAttribute("data-status", "open");
				await page.keyboard.press("Escape");
				await expect(picker).toBeHidden();
			});
		}

		await test.step("Open the series from the picker", async () => {
			await openPicker("Create or open task");
			await suggestion(seriesPath).click();
			await expect.poll(() => page.evaluate(() =>
				(window as any).app.workspace.getActiveFile()?.path
			)).toBe(seriesPath);
		});
	} finally {
		try {
			await page.evaluate(async (folder) => {
				const app = (window as any).app;
				const fixture = app.vault.getAbstractFileByPath(folder);
				if (fixture) await app.vault.delete(fixture, true);
			}, folder);
		} finally {
			await closeObsidian(instance);
		}
	}
});
