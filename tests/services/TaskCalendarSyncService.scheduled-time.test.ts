import { TFile } from "obsidian";
import { TaskCalendarSyncService } from "../../src/services/TaskCalendarSyncService";
import { TaskInfo } from "../../src/types";
import { DEFAULT_GOOGLE_CALENDAR_EXPORT } from "../../src/settings/defaults";

// Use the actual date and recurrence libraries; verify real event payloads.
jest.mock("date-fns", () => jest.requireActual("../../node_modules/date-fns"));
jest.mock("rrule", () => jest.requireActual("../../node_modules/rrule"));

describe("scheduled-time-only Google Calendar export", () => {
	let service: TaskCalendarSyncService;
	let plugin: any;
	let google: any;
	let data: Record<string, any>;
	let tasks: TaskInfo[];
	const task = (values: Partial<TaskInfo> = {}): TaskInfo => ({
		path: "Tasks/commitment.md",
		title: "Commitment",
		scheduled: "2026-09-10T14:00",
		...values,
	});
	const run = async <T>(work: Promise<T>): Promise<T> => {
		await jest.runAllTimersAsync();
		return work;
	};
	beforeEach(() => {
		jest.useFakeTimers();
		TaskCalendarSyncService.clearSharedGoogleCalendarSyncStateForTests();
		data = {};
		tasks = [];
		plugin = {
			settings: {
				googleCalendarExport: {
					...DEFAULT_GOOGLE_CALENDAR_EXPORT,
					enabled: true,
					targetCalendarId: "calendar",
					onlyScheduledTime: true,
					includeDescription: false,
				},
			},
			app: {
				vault: {
					getAbstractFileByPath: jest.fn((path: string) =>
						Object.assign(new TFile(), { path })
					),
					getName: () => "Test",
				},
				fileManager: {
					processFrontMatter: jest.fn(async (file: TFile, fn: (fm: any) => void) => {
						const t = tasks.find((t) => t.path === file.path);
						if (t) fn(t);
					}),
				},
			},
			fieldMapper: { toUserField: (field: string) => field },
			cacheManager: {
				getAllTasks: jest.fn(async () => tasks),
				getTaskInfo: jest.fn(async (path: string) => tasks.find((t) => t.path === path)),
			},
			loadData: async () => data,
			loadPluginDataForSafeWrite: async () => data,
			saveData: async (next: any) => {
				data = next;
			},
			statusManager: { isCompletedStatus: (s: string) => s === "done" },
			i18n: { translate: (key: string) => key },
		};
		google = {
			getAvailableCalendars: jest.fn(() => [{ id: "calendar" }]),
			createEvent: jest.fn(async () => ({ id: "created-event" })),
			updateEvent: jest.fn(async () => ({})),
			deleteEvent: jest.fn(async () => undefined),
		};
		service = new TaskCalendarSyncService(plugin, google);
	});
	afterEach(() => {
		service.destroy();
		jest.useRealTimers();
	});

	it.each([undefined, "", "2026-09-10", "2026-09-10T", "2026-09-10T25:90", "invalidT14:00"])(
		"does not export an absent/date-only/invalid scheduled time: %s",
		async (scheduled) => {
			const t = task({ scheduled, due: "2026-09-10T10:00", timeEstimate: 60 });
			tasks = [t];
			expect(service.shouldSyncTask(t)).toBe(false);
			await run(service.syncTaskToCalendar(t));
			expect(google.createEvent).not.toHaveBeenCalled();
		}
	);
	it.each(["scheduled", "due", "both"])(
		"uses the scheduled time with trigger %s and all-day enabled",
		async (syncTrigger) => {
			plugin.settings.googleCalendarExport.syncTrigger = syncTrigger;
			const t = task({ due: "2026-09-12", timeEstimate: 60 });
			tasks = [t];
			await run(service.syncTaskToCalendar(t));
			const payload = google.createEvent.mock.calls[0][1];
			expect(new Date(payload.start.dateTime).getTime()).toBe(
				new Date(t.scheduled!).getTime()
			);
			expect(
				new Date(payload.end.dateTime).getTime() -
					new Date(payload.start.dateTime).getTime()
			).toBe(60 * 60000);
			expect(payload.start.date).toBeUndefined();
			expect(payload.transparency).toBe("opaque");
			expect(t.googleCalendarEventId).toBe("created-event");
		}
	);
	it.each([
		"2026-09-10T00:00",
		"2026-09-10T23:45",
		"2026-09-10T14:00:00Z",
		"2026-09-10T14:00:30+08:00",
		"2026-03-08T01:30:00-05:00",
	])("preserves midnight, offsets, seconds and DST instants: %s", async (scheduled) => {
		tasks = [task({ scheduled })];
		await run(service.syncTaskToCalendar(tasks[0]));
		const payload = google.createEvent.mock.calls[0][1];
		expect(new Date(payload.start.dateTime).getTime()).toBe(new Date(scheduled).getTime());
		expect(new Date(payload.end.dateTime).getTime() - new Date(scheduled).getTime()).toBe(
			plugin.settings.googleCalendarExport.defaultEventDuration * 60000
		);
	});
	it("handles date-only -> timed -> date-only -> timed without stale links or duplicate events", async () => {
		const t = task({ scheduled: "2026-09-10" });
		tasks = [t];
		await run(service.updateTaskInCalendar({ ...t }));
		expect(google.createEvent).not.toHaveBeenCalled();
		t.scheduled = "2026-09-10T14:00";
		await run(service.updateTaskInCalendar({ ...t }));
		expect(google.createEvent).toHaveBeenCalledTimes(1);
		t.scheduled = "2026-09-10";
		await run(service.updateTaskInCalendar({ ...t }));
		expect(google.deleteEvent).toHaveBeenCalledWith(
			"calendar",
			"created-event",
			expect.any(Number)
		);
		expect(t.googleCalendarEventId).toBeUndefined();
		t.scheduled = "2026-09-10T15:00";
		await run(service.updateTaskInCalendar({ ...t }));
		expect(google.createEvent).toHaveBeenCalledTimes(2);
	});
	it.each(["2026-09-10", undefined])(
		"cleans up after removing the time/date even if task-delete sync is off: %s",
		async (scheduled) => {
			plugin.settings.googleCalendarExport.syncOnTaskDelete = false;
			const t = task({ scheduled, googleCalendarEventId: "existing" });
			tasks = [t];
			await run(service.updateTaskInCalendar(t));
			expect(google.deleteEvent).toHaveBeenCalledTimes(1);
			expect(t.googleCalendarEventId).toBeUndefined();
		}
	);
	it("keeps the normal task-file deletion preference", async () => {
		plugin.settings.googleCalendarExport.syncOnTaskDelete = false;
		tasks = [task({ googleCalendarEventId: "existing" })];
		await run(service.deleteTaskFromCalendar(tasks[0]));
		expect(google.deleteEvent).not.toHaveBeenCalled();
	});
	it("bulk sync removes old date-only events and updates timed events", async () => {
		tasks = [
			task({ scheduled: "2026-09-10", googleCalendarEventId: "old" }),
			task({ path: "Tasks/timed.md", googleCalendarEventId: "timed" }),
			task({ path: "Tasks/skip.md", scheduled: "2026-09-10" }),
		];
		const result = await run(service.syncAllTasks());
		expect(result).toEqual({ synced: 2, failed: 0, skipped: 1 });
		expect(google.deleteEvent).toHaveBeenCalledWith("calendar", "old", expect.any(Number));
		expect(google.updateEvent.mock.calls[0][2].start.dateTime).toBeDefined();
	});
	it("completion removes an ineligible linked event instead of updating its title", async () => {
		tasks = [task({ scheduled: "2026-09-10", status: "done", googleCalendarEventId: "old" })];
		await run(service.completeTaskInCalendar(tasks[0]));
		expect(google.deleteEvent).toHaveBeenCalledTimes(1);
		expect(google.updateEvent).not.toHaveBeenCalled();
	});
	it.each([404, 410])(
		"clears links when Google reports an already removed event (%s)",
		async (status) => {
			google.deleteEvent.mockRejectedValue(Object.assign(new Error("Gone"), { status }));
			tasks = [task({ scheduled: "2026-09-10", googleCalendarEventId: "old" })];
			expect(await run(service.syncTaskToCalendar(tasks[0]))).toBe(true);
			expect(tasks[0].googleCalendarEventId).toBeUndefined();
		}
	);
	it("persists failed deletion and retries after service restart", async () => {
		plugin.settings.googleCalendarExport.syncOnTaskDelete = false;
		google.deleteEvent.mockRejectedValueOnce(new Error("offline"));
		tasks = [task({ scheduled: "2026-09-10", googleCalendarEventId: "old" })];
		expect(await run(service.syncTaskToCalendar(tasks[0]))).toBe(false);
		expect(tasks[0].googleCalendarEventId).toBe("old");
		expect(data.googleCalendarDeletionQueue).toHaveLength(1);
		service.destroy();
		service = new TaskCalendarSyncService(plugin, google);
		expect((await run(service.processDeletionQueue())).deleted).toBe(1);
		expect(data.googleCalendarDeletionQueue).toHaveLength(0);
		expect(tasks[0].googleCalendarEventId).toBeUndefined();
	});
	it("queues disconnected cleanup without calling Google", async () => {
		google.getAvailableCalendars.mockReturnValue([]);
		tasks = [task({ scheduled: "2026-09-10", googleCalendarEventId: "old" })];
		expect(await run(service.syncTaskToCalendar(tasks[0]))).toBe(false);
		expect(google.deleteEvent).not.toHaveBeenCalled();
		expect(data.googleCalendarDeletionQueue).toHaveLength(1);
	});
	it("cancels stale cleanup when a time is restored before retry", async () => {
		google.deleteEvent.mockRejectedValueOnce(new Error("offline"));
		tasks = [task({ scheduled: "2026-09-10", googleCalendarEventId: "old" })];
		await run(service.syncTaskToCalendar(tasks[0]));
		tasks[0].scheduled = "2026-09-10T14:00";
		await run(service.processDeletionQueue());
		expect(google.deleteEvent).toHaveBeenCalledTimes(1);
		expect(tasks[0].googleCalendarEventId).toBe("old");
		await run(service.syncTaskToCalendar(tasks[0]));
		expect(google.updateEvent).toHaveBeenCalledTimes(1);
	});
	it("startup removes existing date-only links without requiring a changed fingerprint", async () => {
		tasks = [task({ scheduled: "2026-09-10", googleCalendarEventId: "old" })];
		await run(service.initializeExternalFileReconciliation());
		expect(google.deleteEvent).toHaveBeenCalledTimes(1);
	});
	it("startup creates an event for a date-only task given a time while closed", async () => {
		tasks = [task({ scheduled: "2026-09-10" })];
		await run(service.initializeExternalFileReconciliation());
		service.destroy();
		tasks[0].scheduled = "2026-09-10T14:00";
		service = new TaskCalendarSyncService(plugin, google);
		await run(service.initializeExternalFileReconciliation());
		expect(google.createEvent).toHaveBeenCalledTimes(1);
	});
	it("does not replay an old queued creation for a date-only task", async () => {
		tasks = [task({ scheduled: "2026-09-10" })];
		data.googleCalendarSyncQueue = [{ taskPath: tasks[0].path, createdAt: 1, attempts: 0 }];
		await run(service.processPendingSyncQueue());
		expect(google.createEvent).not.toHaveBeenCalled();
		expect(data.googleCalendarSyncQueue).toHaveLength(0);
	});
	it("keeps recurring events timed even with date-only DTSTART", async () => {
		tasks = [task({ recurrence: "DTSTART:20260910;FREQ=DAILY" })];
		await run(service.syncTaskToCalendar(tasks[0]));
		const payload = google.createEvent.mock.calls[0][1];
		expect(payload.recurrence).toBeDefined();
		expect(payload.start.dateTime).toBeDefined();
		expect(payload.start.date).toBeUndefined();
	});
	it("deletes the recurring series and detached exception when the time is removed", async () => {
		tasks = [
			task({
				scheduled: "2026-09-10",
				recurrence: "FREQ=DAILY",
				googleCalendarEventId: "series",
				googleCalendarExceptionEventId: "exception",
				googleCalendarExceptionOriginalScheduled: "2026-09-09T14:00",
			}),
		];
		await run(service.syncTaskToCalendar(tasks[0]));
		expect(google.deleteEvent.mock.calls.map((c: any[]) => c[1])).toEqual([
			"series",
			"exception",
		]);
		expect(tasks[0].googleCalendarExceptionEventId).toBeUndefined();
	});
	it("handles exception-only links during queued recovery", async () => {
		tasks = [task({ scheduled: "2026-09-10", googleCalendarExceptionEventId: "exception" })];
		data.googleCalendarSyncQueue = [{ taskPath: tasks[0].path, createdAt: 1, attempts: 0 }];
		await run(service.processPendingSyncQueue());
		expect(google.deleteEvent).toHaveBeenCalledWith(
			"calendar",
			"exception",
			expect.any(Number)
		);
	});
	it("preserves old date-only exports when the new setting is absent or off", async () => {
		delete plugin.settings.googleCalendarExport.onlyScheduledTime;
		tasks = [task({ scheduled: "2026-09-10" })];
		await run(service.syncTaskToCalendar(tasks[0]));
		expect(google.createEvent.mock.calls[0][1].start).toEqual({ date: "2026-09-10" });
	});
	it("does not modify Google or metadata when export is disabled", async () => {
		plugin.settings.googleCalendarExport.enabled = false;
		tasks = [task({ scheduled: "2026-09-10", googleCalendarEventId: "old" })];
		await run(service.syncTaskToCalendar(tasks[0]));
		expect(google.deleteEvent).not.toHaveBeenCalled();
		expect(tasks[0].googleCalendarEventId).toBe("old");
	});
	it("does not export archived tasks", async () => {
		expect(service.shouldSyncTask(task({ archived: true }))).toBe(false);
	});
	it("removes an event whose creation finishes after its time was removed", async () => {
		let finishCreate!: (value: { id: string }) => void;
		google.createEvent.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishCreate = resolve;
				})
		);
		tasks = [task()];
		const creation = service.syncTaskToCalendar({ ...tasks[0] });
		await jest.runAllTimersAsync();
		expect(google.createEvent).toHaveBeenCalledTimes(1);
		tasks[0].scheduled = "2026-09-10";
		const cleanup = service.updateTaskInCalendar({ ...tasks[0] });
		await jest.runAllTimersAsync();
		finishCreate({ id: "late-event" });
		await run(Promise.all([creation, cleanup]));
		expect(google.deleteEvent).toHaveBeenCalledWith(
			"calendar",
			"late-event",
			expect.any(Number)
		);
		expect(tasks[0].googleCalendarEventId).toBeUndefined();
	});
	it("rapid edits export only the latest scheduled state", async () => {
		tasks = [task()];
		void service.updateTaskInCalendar({ ...tasks[0] });
		tasks[0].scheduled = "2026-09-10";
		await run(service.updateTaskInCalendar({ ...tasks[0] }));
		expect(google.createEvent).not.toHaveBeenCalled();
	});
	it("uses scheduled reminders even when the old trigger is due", async () => {
		plugin.settings.googleCalendarExport.syncTrigger = "due";
		tasks = [
			task({
				due: "2026-09-11",
				reminders: [
					{
						id: "reminder",
						type: "relative",
						relatedTo: "scheduled",
						offset: "-PT15M",
					} as any,
				],
			}),
		];
		await run(service.syncTaskToCalendar(tasks[0]));
		expect(google.createEvent.mock.calls[0][1].reminders?.overrides).toEqual([
			{ method: "popup", minutes: 15 },
		]);
	});
});
