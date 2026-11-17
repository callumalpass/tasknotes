/**
 * Issue #1147: Deleting a time block does not remove the Pomodoro session
 *
 * Users need a way to remove an erroneous Pomodoro session, for example one left
 * running when the device was closed. The Pomodoro view's "Recent sessions" list
 * deletes a session from history after confirmation. Task time entries are not
 * changed.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1147
 */

import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, ObsidianApp, runCommand } from "../obsidian";

let app: ObsidianApp;

test.beforeAll(async () => {
	app = await launchObsidian();
});

test.afterAll(async () => {
	if (app) await closeObsidian(app);
});

test("deletes a daily-note Pomodoro session from Recent sessions (#1147)", async () => {
	const page = app.page;
	const sessionId = `e2e-1147-${Date.now()}`;

	// Daily-note storage is the default and the case where metadata lags behind the write.
	const setup = await page.evaluate(async (id) => {
		const obsidian = (window as any).app;
		const plugin = obsidian.plugins.plugins.tasknotes;
		const storage = plugin.settings.pomodoroStorageLocation;
		plugin.settings.pomodoroStorageLocation = "daily-notes";
		const notePath = `${window.moment().format("YYYY-MM-DD")}.md`;
		const existed = Boolean(obsidian.vault.getAbstractFileByPath(notePath));
		// Local-offset timestamps, as recorded sessions use, so the session lands in today's note.
		const stamp = (ms: number) => window.moment(ms).format("YYYY-MM-DDTHH:mm:ss.SSSZ");
		const end = Date.now() - 60_000;
		const startTime = stamp(end - 25 * 60_000);
		const endTime = stamp(end);
		await plugin.pomodoroService.addSessionToHistory({
			id,
			startTime,
			endTime,
			plannedDuration: 25,
			type: "work",
			completed: true,
			interrupted: false,
			activePeriods: [{ startTime, endTime }],
		});
		return { storage, createdNote: existed ? null : notePath };
	}, sessionId);

	const hasSession = () =>
		page.evaluate(async (id) => {
			const plugin = (window as any).app.plugins.plugins.tasknotes;
			const history = await plugin.pomodoroService.getSessionHistory();
			return history.some((session: { id: string }) => session.id === id);
		}, sessionId);

	try {
		await expect.poll(hasSession).toBe(true);
		await runCommand(page, "TaskNotes: Open Pomodoro timer");
		const recent = page.locator(".pomodoro-view__recent");
		await recent.locator("summary").click();
		const rows = recent.locator(".pomodoro-view__recent-item");
		await expect(rows.first()).toBeVisible();
		const before = await rows.count();

		await rows.first().hover();
		await rows.first().locator(".pomodoro-view__recent-delete").click();
		await page.locator(".modal-container button.mod-warning").click();

		await expect.poll(hasSession).toBe(false);
		await expect(rows).toHaveCount(before - 1);
	} finally {
		await page.evaluate(async ({ storage, createdNote }) => {
			const obsidian = (window as any).app;
			obsidian.plugins.plugins.tasknotes.settings.pomodoroStorageLocation = storage;
			const file = createdNote ? obsidian.vault.getAbstractFileByPath(createdNote) : null;
			if (file) await obsidian.vault.delete(file);
		}, setup);
	}
});
