import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "./obsidian";

let instance: ObsidianApp;
test.beforeAll(async () => { instance = await launchObsidian(); });
test.afterAll(async () => { if (instance) await closeObsidian(instance); });

for (const writer of [
	{ service: "autoArchiveService", method: "clearQueue", operation: "save-auto-archive-queue", args: [] },
	{ service: "icsSubscriptionService", method: "saveSubscriptions", operation: "save-ics-subscriptions", args: [] },
	{ service: "pomodoroService", method: "saveState", operation: "save-pomodoro-state", args: [] },
	{ service: "pomodoroService", method: "saveLastSelectedTask", operation: "save-last-selected-task", args: ["release-probe.md"] },
	{ service: "pomodoroService", method: "savePluginHistory", operation: "save-pomodoro-history", args: [[]] },
]) test(`${writer.operation} cannot overwrite a concurrent settings save`, async () => {
	const result = await instance.page.evaluate(async (writer) => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const originalLoad = plugin.loadData;
		const originalSave = plugin.saveData;
		const originalSafeLoad = plugin.loadPluginDataForSafeWrite;
		const originalPriority = plugin.settings.defaultTaskPriority;
		let stored = structuredClone(await originalLoad.call(plugin));
		stored.defaultTaskPriority = "normal";
		stored.pomodoroState = null;
		const selectedPath = plugin.pomodoroService.lastSelectedTaskPath;
		const selectedLoaded = plugin.pomodoroService.lastSelectedTaskPathLoaded;
		let release!: () => void;
		let captured!: () => void;
		const paused = new Promise<void>((resolve) => { captured = resolve; });
		const resume = new Promise<void>((resolve) => { release = resolve; });
		let queueWrite: Promise<void> | undefined;
		let settingsWrite: Promise<void> | undefined;
		try {
			// Virtualize only the disk boundary; invoke the real native services.
			plugin.loadData = async () => structuredClone(stored);
			plugin.saveData = async (data: unknown) => { stored = structuredClone(data); };
			plugin.loadPluginDataForSafeWrite = async (operation: string) => {
				const data = await originalSafeLoad.call(plugin, operation);
				if (operation === writer.operation) {
					captured();
					await resume;
				}
				return data;
			};
			queueWrite = plugin[writer.service][writer.method](...writer.args);
			await paused;
			plugin.settings.defaultTaskPriority = "high";
			settingsWrite = plugin.saveSettingsDataOnly();
			// Drain resolved-promise continuations, not filesystem timing.
			await new Promise((resolve) => setTimeout(resolve, 0));
			release();
			await Promise.all([queueWrite, settingsWrite]);
			return stored.defaultTaskPriority;
		} finally {
			release();
			await Promise.allSettled([queueWrite, settingsWrite]);
			plugin.loadData = originalLoad;
			plugin.saveData = originalSave;
			plugin.loadPluginDataForSafeWrite = originalSafeLoad;
			plugin.settings.defaultTaskPriority = originalPriority;
			plugin.pomodoroService.lastSelectedTaskPath = selectedPath;
			plugin.pomodoroService.lastSelectedTaskPathLoaded = selectedLoaded;
		}
	}, writer);
	expect(result).toBe("high");
});
