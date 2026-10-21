/**
 * Issue #2413: reminders missed while Obsidian was closed are delivered on startup.
 */

import { TFile } from "obsidian";
import { NotificationService } from "../../../src/ui/NotificationService";
import { TaskInfo } from "../../../src/types";

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

	const startObsidian = async () => {
		const byPath = () => new Map(tasks.map((task) => [task.path, task]));
		const plugin = {
			settings: { enableNotifications, notificationType: "in-app", defaultTaskStatus: "open" },
			statusManager: statuses,
			emitter: { on: jest.fn(), offref: jest.fn() },
			cacheManager: { getAllCachedTasks: () => tasks },
			fieldMapper: { mapFromFrontmatter: (fm: TaskInfo) => fm },
			app: {
				loadLocalStorage: (key: string) => storage.get(key) ?? null,
				saveLocalStorage: (key: string, value: unknown) => storage.set(key, value),
				vault: { getAbstractFileByPath: (path: string) => new TFile(path) },
				metadataCache: {
					getFileCache: (file: TFile) => ({ frontmatter: byPath().get(file.path) }),
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
});
