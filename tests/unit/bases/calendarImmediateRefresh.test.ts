import { CalendarView } from "../../../src/bases/CalendarView";
import { TaskFactory } from "../../helpers/mock-factories";

jest.mock("obsidian");

describe("Calendar immediate task refresh", () => {
	it("refreshes FullCalendar immediately for expected task updates", async () => {
		const originalTask = TaskFactory.createTask({
			path: "TaskNotes/Event.md",
			due: "2026-05-19",
			status: "open",
		});
		const updatedTask = TaskFactory.createTask({
			...originalTask,
			due: "2026-05-20",
		});
		const calendar = {
			refetchEvents: jest.fn(),
		};
		const view = Object.create(CalendarView.prototype) as CalendarView & {
			_expectingImmediateUpdate: boolean;
			currentTasks: typeof originalTask[];
			calendar: typeof calendar;
			plugin: {
				cacheManager: {
					getCachedTaskInfoSync: jest.Mock;
				};
			};
			handleTaskUpdate(task: typeof originalTask): Promise<void>;
		};
		Object.assign(view, {
			_expectingImmediateUpdate: true,
			calendar,
			currentTasks: [originalTask],
			plugin: {
				cacheManager: {
					getCachedTaskInfoSync: jest.fn(() => originalTask),
				},
			},
		});

		await view.handleTaskUpdate(updatedTask);

		expect(view._expectingImmediateUpdate).toBe(false);
		expect(view.currentTasks).toHaveLength(1);
		expect(view.currentTasks[0]).toMatchObject({
			path: updatedTask.path,
			due: "2026-05-20",
		});
		expect(calendar.refetchEvents).toHaveBeenCalledTimes(1);
	});

	it("keeps ordinary task updates on the debounced refresh path", async () => {
		const task = TaskFactory.createTask({
			path: "TaskNotes/Event.md",
		});
		const calendar = {
			refetchEvents: jest.fn(),
		};
		const view = Object.create(CalendarView.prototype) as CalendarView & {
			_expectingImmediateUpdate: boolean;
			calendar: typeof calendar;
			debouncedRefresh: jest.Mock;
			handleTaskUpdate(task: typeof task, source?: "metadata-cache"): Promise<void>;
		};
		Object.assign(view, {
			_expectingImmediateUpdate: false,
			calendar,
			debouncedRefresh: jest.fn(),
		});

		await view.handleTaskUpdate(task, "metadata-cache");

		expect(view.debouncedRefresh).toHaveBeenCalledTimes(1);
		expect(calendar.refetchEvents).not.toHaveBeenCalled();
	});

	it("refreshes TaskNotes service updates without rendering from stale Bases data", async () => {
		const originalTask = TaskFactory.createTask({
			path: "TaskNotes/Event.md",
			scheduled: "2026-05-19T09:00",
			priority: "normal",
		});
		const updatedTask = TaskFactory.createTask({
			...originalTask,
			scheduled: "2026-05-19T10:00",
			priority: "high",
		});
		const calendar = {
			refetchEvents: jest.fn(),
		};
		const view = Object.create(CalendarView.prototype) as CalendarView & {
			_expectingImmediateUpdate: boolean;
			currentTasks: typeof originalTask[];
			calendar: typeof calendar;
			debouncedRefresh: jest.Mock;
			plugin: {
				cacheManager: {
					getCachedTaskInfoSync: jest.Mock;
				};
			};
			handleTaskUpdate(task: typeof updatedTask, source: "tasknotes-service"): Promise<void>;
		};
		Object.assign(view, {
			_expectingImmediateUpdate: false,
			calendar,
			currentTasks: [originalTask],
			debouncedRefresh: jest.fn(),
			plugin: {
				cacheManager: {
					getCachedTaskInfoSync: jest.fn(() => originalTask),
				},
			},
		});

		await view.handleTaskUpdate(updatedTask, "tasknotes-service");

		expect(view.debouncedRefresh).not.toHaveBeenCalled();
		expect(view.currentTasks[0]).toMatchObject({
			path: updatedTask.path,
			scheduled: "2026-05-19T10:00",
			priority: "high",
		});
		expect(calendar.refetchEvents).toHaveBeenCalledTimes(1);
	});

	it("refreshes direct calendar writes without the expected-update flag", async () => {
		const originalTask = TaskFactory.createTask({
			path: "TaskNotes/Event.md",
			due: "2026-05-19",
			status: "open",
		});
		const updatedTask = TaskFactory.createTask({
			...originalTask,
			due: "2026-05-20",
		});
		const calendar = {
			refetchEvents: jest.fn(),
		};
		const view = Object.create(CalendarView.prototype) as CalendarView & {
			_expectingImmediateUpdate: boolean;
			currentTasks: typeof originalTask[];
			calendar: typeof calendar;
			plugin: {
				cacheManager: {
					getCachedTaskInfoSync: jest.Mock;
				};
			};
			refreshAfterDirectCalendarTaskWrite(task: typeof updatedTask): Promise<void>;
		};
		Object.assign(view, {
			_expectingImmediateUpdate: false,
			calendar,
			currentTasks: [originalTask],
			updateDebounceTimer: null,
			dataUpdateDebounceTimer: null,
			plugin: {
				cacheManager: {
					getCachedTaskInfoSync: jest.fn(() => originalTask),
				},
			},
		});

		await view.refreshAfterDirectCalendarTaskWrite(updatedTask);

		expect(view._expectingImmediateUpdate).toBe(false);
		expect(view.currentTasks[0]).toMatchObject({
			path: updatedTask.path,
			due: "2026-05-20",
		});
		expect(calendar.refetchEvents).toHaveBeenCalledTimes(1);
	});

	it("clears stale pending renders after direct calendar writes", async () => {
		jest.useFakeTimers();
		try {
			const originalTask = TaskFactory.createTask({
				path: "TaskNotes/Event.md",
				due: "2026-05-19",
			});
			const updatedTask = TaskFactory.createTask({
				...originalTask,
				due: "2026-05-20",
			});
			const calendar = {
				refetchEvents: jest.fn(),
			};
			const view = Object.create(CalendarView.prototype) as CalendarView & {
				currentTasks: typeof originalTask[];
				calendar: typeof calendar;
				updateDebounceTimer: number | null;
				dataUpdateDebounceTimer: number | null;
				plugin: {
					cacheManager: {
						getCachedTaskInfoSync: jest.Mock;
					};
				};
				refreshAfterDirectCalendarTaskWrite(task: typeof updatedTask): Promise<void>;
			};
			Object.assign(view, {
				calendar,
				currentTasks: [originalTask],
				updateDebounceTimer: window.setTimeout(jest.fn(), 300),
				dataUpdateDebounceTimer: window.setTimeout(jest.fn(), 300),
				plugin: {
					cacheManager: {
						getCachedTaskInfoSync: jest.fn(() => originalTask),
					},
				},
			});

			await view.refreshAfterDirectCalendarTaskWrite(updatedTask);

			expect(view.updateDebounceTimer).toBeNull();
			expect(view.dataUpdateDebounceTimer).toBeNull();
			expect(calendar.refetchEvents).toHaveBeenCalledTimes(1);
		} finally {
			jest.useRealTimers();
		}
	});

	it("can include a newly created calendar task before Bases has refreshed", async () => {
		const existingTask = TaskFactory.createTask({
			path: "TaskNotes/Existing.md",
			due: "2026-05-19",
		});
		const createdTask = TaskFactory.createTask({
			path: "TaskNotes/New.md",
			due: "2026-05-19",
		});
		const calendar = {
			refetchEvents: jest.fn(),
		};
		const view = Object.create(CalendarView.prototype) as CalendarView & {
			currentTasks: typeof existingTask[];
			calendar: typeof calendar;
			plugin: {
				cacheManager: {
					getCachedTaskInfoSync: jest.Mock;
				};
			};
			refreshCalendarWithFreshData(task?: typeof createdTask): Promise<void>;
		};
		Object.assign(view, {
			calendar,
			currentTasks: [existingTask],
			plugin: {
				cacheManager: {
					getCachedTaskInfoSync: jest.fn((path: string) =>
						path === createdTask.path ? null : existingTask
					),
				},
			},
		});

		await view.refreshCalendarWithFreshData(createdTask);

		expect(view.currentTasks).toEqual([existingTask, createdTask]);
		expect(calendar.refetchEvents).toHaveBeenCalledTimes(1);
	});
});
