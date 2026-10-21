/**
 * Issue #2413: reminders missed while Obsidian was closed are delivered on startup.
 */

import { TFile } from "obsidian";
import { NotificationService } from "../../../src/ui/NotificationService";
import { TaskInfo } from "../../../src/types";
import { createI18nService } from "../../../src/i18n";

const statuses = {
	getCompletedStatuses: () => ["done"],
	isCompletedStatus: (status: string) => status === "done",
};

const reminderTask = (name: string, absoluteTime: string): TaskInfo => ({
	path: `Tasks/${name}.md`,
	title: name,
	status: "open",
	priority: "normal",
	reminders: [{ id: `rem-${name}`, type: "absolute", absoluteTime }],
});

describe("Issue #2413: missed reminders on startup", () => {
	let storage: Map<string, unknown>;
	let tasks: TaskInfo[];
	let services: any[];
	let enableNotifications: boolean;
	let locale: string;
	let unindexed: Set<string>;
	let onIndexed: ((file: TFile) => void) | undefined;
	let onRenamed: ((file: TFile, oldPath: string) => void) | undefined;

	const startObsidian = async () => {
		const byPath = () => new Map(tasks.map((task) => [task.path, task]));
		const plugin = {
			settings: { enableNotifications, notificationType: "in-app", defaultTaskStatus: "open" },
			statusManager: statuses,
			i18n: createI18nService({ initialLocale: locale }),
			emitter: { on: jest.fn(), offref: jest.fn() },
			cacheManager: {
				getAllCachedTasks: () => tasks.filter((task) => !unindexed.has(task.path)),
			},
			fieldMapper: { mapFromFrontmatter: (fm: TaskInfo) => fm },
			app: {
				loadLocalStorage: (key: string) => storage.get(key) ?? null,
				saveLocalStorage: (key: string, value: unknown) => storage.set(key, value),
				vault: {
					getAbstractFileByPath: (path: string) => new TFile(path),
					getMarkdownFiles: () => tasks.map((task) => new TFile(task.path)),
					on: (name: string, callback: (file: TFile, oldPath: string) => void) => {
						if (name === "rename") onRenamed = callback;
						return {};
					},
					offref: () => {},
				},
				metadataCache: {
					getFileCache: (file: TFile) =>
						unindexed.has(file.path) ? null : { frontmatter: byPath().get(file.path) },
					on: (name: string, callback: (file: TFile) => void) => {
						if (name === "changed") onIndexed = callback;
						return {};
					},
					offref: () => {},
				},
			},
		};
		const service: any = new NotificationService(plugin as any);
		jest.spyOn(service, "showInAppNotice").mockImplementation(() => {});
		jest.spyOn(service, "showMissedSummaryNotice").mockImplementation(() => {});
		services.push(service);
		await service.initialize();
		await Promise.resolve();
		return service;
	};

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-06-01T10:00:00"));
		storage = new Map();
		tasks = [];
		services = [];
		enableNotifications = true;
		locale = "en";
		unindexed = new Set();
		onIndexed = undefined;
		onRenamed = undefined;
	});

	afterEach(() => {
		services.forEach((service) => service.destroy());
		jest.useRealTimers();
	});

	it("delivers a reminder missed while closed once, worded as missed", async () => {
		tasks = [reminderTask("standup", "2026-06-01T10:10:00")];
		(await startObsidian()).destroy();

		jest.setSystemTime(new Date("2026-06-01T10:30:00"));
		const afterRestart = await startObsidian();
		expect(afterRestart.showInAppNotice).toHaveBeenCalledTimes(1);
		expect(afterRestart.showInAppNotice.mock.calls[0][0]).toMatch(/^Missed reminder \(.+\): standup$/);
		afterRestart.destroy();

		jest.setSystemTime(new Date("2026-06-01T10:31:00"));
		const secondRestart = await startObsidian();
		expect(secondRestart.showInAppNotice).not.toHaveBeenCalled();
	});

	it("does not replay reminders delivered on time before a restart", async () => {
		tasks = [reminderTask("standup", "2026-06-01T10:01:00")];
		const service = await startObsidian();
		jest.setSystemTime(new Date("2026-06-01T10:01:10"));
		service.checkNotificationQueue();
		await Promise.resolve();
		expect(service.showInAppNotice).toHaveBeenCalledTimes(1);
		service.destroy();

		jest.setSystemTime(new Date("2026-06-01T10:02:00"));
		expect((await startObsidian()).showInAppNotice).not.toHaveBeenCalled();
	});

	it("summarises many missed tasks, keeping the latest reminder per task", async () => {
		tasks = ["a", "b", "c", "d"].map((name) => reminderTask(name, "2026-06-01T10:10:00"));
		tasks[0].reminders!.push({ id: "later", type: "absolute", absoluteTime: "2026-06-01T10:20:00" });
		(await startObsidian()).destroy();

		jest.setSystemTime(new Date("2026-06-01T11:00:00"));
		const service = await startObsidian();
		expect(service.showInAppNotice).not.toHaveBeenCalled();
		expect(service.showMissedSummaryNotice).toHaveBeenCalledTimes(1);
		const [title, missed] = service.showMissedSummaryNotice.mock.calls[0];
		expect(title).toBe("4 missed TaskNotes reminders");
		expect(missed.map((entry: { path: string }) => entry.path)).toEqual([
			"Tasks/b.md",
			"Tasks/c.md",
			"Tasks/d.md",
			"Tasks/a.md",
		]);
	});

	it("waits for metadata indexing before catching up tasks changed while closed", async () => {
		(await startObsidian()).destroy();

		// Written while closed (e.g. by sync), so not yet indexed at startup.
		tasks = ["a", "b", "c", "d"].map((name) => reminderTask(name, "2026-06-01T10:10:00"));
		unindexed = new Set(tasks.map((task) => task.path));
		jest.setSystemTime(new Date("2026-06-01T10:30:00"));
		const service = await startObsidian();
		expect(service.showMissedSummaryNotice).not.toHaveBeenCalled();

		jest.setSystemTime(new Date("2026-06-01T10:31:00"));
		for (const path of [...unindexed]) {
			expect(service.showMissedSummaryNotice).not.toHaveBeenCalled();
			unindexed.delete(path);
			onIndexed!(new TFile(path));
		}
		await Promise.resolve();
		expect(service.showMissedSummaryNotice).toHaveBeenCalledTimes(1);
		expect(service.showMissedSummaryNotice.mock.calls[0][0]).toBe("4 missed TaskNotes reminders");
	});

	it("resumes indexed reminders after five minutes without losing pending catch-up or its saved cursor", async () => {
		(await startObsidian()).destroy();
		const boundary = storage.get("tasknotes-reminder-scan-cursor");
		tasks = [reminderTask("ready", "2026-06-01T10:35:00"), reminderTask("late", "2026-06-01T10:10:00")];
		unindexed.add(tasks[1].path);
		jest.setSystemTime(new Date("2026-06-01T10:30:00"));
		const service = await startObsidian();

		jest.setSystemTime(new Date("2026-06-01T10:36:00"));
		await service.refreshReminders();
		expect(service.showInAppNotice).toHaveBeenCalledTimes(1);
		expect(service.showInAppNotice.mock.calls[0][0]).toContain("ready");
		expect(storage.get("tasknotes-reminder-scan-cursor")).toBe(boundary);
		// Quick checks must not persist a newer cursor either.
		jest.setSystemTime(new Date("2026-06-01T10:37:00"));
		service.checkNotificationQueue();
		expect(storage.get("tasknotes-reminder-scan-cursor")).toBe(boundary);

		unindexed.clear();
		onIndexed!(new TFile(tasks[1].path));
		await Promise.resolve();
		expect(service.showInAppNotice).toHaveBeenCalledTimes(2);
		expect(service.showInAppNotice.mock.calls[1][0]).toMatch(/^Missed reminder \(.+\): late$/);
		expect(storage.get("tasknotes-reminder-scan-cursor")).toBe(Date.now());
	});

	it("keeps a renamed unindexed task pending until its new path is indexed", async () => {
		(await startObsidian()).destroy();
		const boundary = storage.get("tasknotes-reminder-scan-cursor");
		tasks = [reminderTask("renamed", "2026-06-01T10:10:00")];
		const oldPath = tasks[0].path;
		unindexed.add(oldPath);
		jest.setSystemTime(new Date("2026-06-01T10:30:00"));
		const service = await startObsidian();
		tasks[0].path = "Tasks/new-name.md";
		unindexed.delete(oldPath);
		unindexed.add(tasks[0].path);
		onRenamed!(new TFile(tasks[0].path), oldPath);
		expect(service.showInAppNotice).not.toHaveBeenCalled();
		expect(storage.get("tasknotes-reminder-scan-cursor")).toBe(boundary);

		unindexed.clear();
		onIndexed!(new TFile(tasks[0].path));
		await Promise.resolve();
		expect(service.showInAppNotice).toHaveBeenCalledTimes(1);
		expect(service.showInAppNotice.mock.calls[0][0]).toMatch(/^Missed reminder \(.+\): renamed$/);
	});

	it("does not replay reminders from while notifications were disabled", async () => {
		tasks = [reminderTask("standup", "2026-06-01T10:10:00")];
		(await startObsidian()).destroy();
		enableNotifications = false;
		jest.setSystemTime(new Date("2026-06-01T10:05:00"));
		(await startObsidian()).destroy();

		enableNotifications = true;
		jest.setSystemTime(new Date("2026-06-01T10:30:00"));
		expect((await startObsidian()).showInAppNotice).not.toHaveBeenCalled();
	});

	it("words missed reminders and the summary in the selected language", async () => {
		locale = "de";
		tasks = [
			{
				...reminderTask("Bericht", "2026-06-01T10:10:00"),
				due: "2026-06-01T10:15",
				reminders: [{ id: "rel", type: "relative", relatedTo: "due", offset: "-PT5M" }],
			},
		];
		(await startObsidian()).destroy();

		jest.setSystemTime(new Date("2026-06-01T10:30:00"));
		const service = await startObsidian();
		expect(service.showInAppNotice.mock.calls[0][0]).toMatch(
			/^Verpasste Erinnerung \(.+\): Bericht war um .+ fällig$/
		);
		service.destroy();

		locale = "ru";
		tasks = ["a", "b", "c", "d"].map((name) => reminderTask(name, "2026-06-01T10:40:00"));
		(await startObsidian()).destroy();
		jest.setSystemTime(new Date("2026-06-01T11:00:00"));
		const summary = await startObsidian();
		expect(summary.showMissedSummaryNotice.mock.calls[0][0]).toBe(
			"Пропущено напоминаний TaskNotes: 4"
		);
	});
});
