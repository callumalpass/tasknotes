/**
 * Regression tests for issue #1689.
 *
 * Reminders are plain frontmatter data, so direct file edits need to refresh the
 * notification queue just like TaskNotes UI edits do.
 */

import { NotificationService } from "../../../src/ui/NotificationService";
import { Reminder, TaskInfo } from "../../../src/types";

class TestEmitter {
	private listeners = new Map<string, Set<(...args: any[]) => void>>();

	on(event: string, callback: (...args: any[]) => void): { event: string; callback: (...args: any[]) => void } {
		const listeners = this.listeners.get(event) ?? new Set<(...args: any[]) => void>();
		listeners.add(callback);
		this.listeners.set(event, listeners);
		return { event, callback };
	}

	offref(ref: { event: string; callback: (...args: any[]) => void }): void {
		this.listeners.get(ref.event)?.delete(ref.callback);
	}

	trigger(event: string, ...args: any[]): void {
		for (const listener of this.listeners.get(event) ?? []) {
			listener(...args);
		}
	}
}

const flushPromises = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
};

const createService = () => {
	const emitter = new TestEmitter();
	const cacheManager = {
		getAllTasks: jest.fn<Promise<TaskInfo[]>, []>().mockResolvedValue([]),
		getTaskInfo: jest.fn<Promise<TaskInfo | null>, [string]>(),
	};
	const plugin = {
		settings: {
			enableNotifications: true,
			notificationType: "in-app",
		},
		cacheManager,
		emitter,
	};

	return {
		cacheManager,
		emitter,
		service: new NotificationService(plugin as any),
	};
};

describe("Issue #1689: reminders edited in frontmatter refresh notification timers", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it("queues a reminder added by direct file edit without waiting for the next broad scan", async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-03-22T14:00:00"));

		const taskPath = "Tasks/direct-edit.md";
		const reminder: Reminder = {
			id: "rem_1773167100000",
			type: "relative",
			relatedTo: "scheduled",
			offset: "-PT1M",
			description: "1 minute before",
		};
		const updatedTask: TaskInfo = {
			path: taskPath,
			title: "Direct edit reminder",
			status: "open",
			priority: "normal",
			scheduled: "2026-03-22T14:02:00",
			reminders: [reminder],
		};
		const { cacheManager, emitter, service } = createService();
		cacheManager.getTaskInfo.mockResolvedValue(updatedTask);

		await service.initialize();
		expect((service as any).notificationQueue).toEqual([]);

		emitter.trigger("file-updated", { path: taskPath });
		await flushPromises();

		expect(cacheManager.getTaskInfo).toHaveBeenCalledWith(taskPath);
		expect((service as any).notificationQueue).toEqual([
			expect.objectContaining({
				taskPath,
				reminder,
				notifyAt: new Date("2026-03-22T14:01:00").getTime(),
			}),
		]);

		service.destroy();
	});

	it("clears processed state and recalculates a relative reminder when the task date changes", async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-03-22T14:30:00"));

		const taskPath = "Tasks/my-task.md";
		const reminder: Reminder = {
			id: "rem_1773167100000",
			type: "relative",
			relatedTo: "scheduled",
			offset: "-PT5M",
			description: "5 minutes before",
		};
		const reminderKey = `${taskPath}-${reminder.id}`;
		const updatedTask: TaskInfo = {
			path: taskPath,
			title: "Rescheduled task",
			status: "open",
			priority: "normal",
			scheduled: "2026-03-22T14:40:00",
			reminders: [reminder],
		};
		const { cacheManager, emitter, service } = createService();
		cacheManager.getTaskInfo.mockResolvedValue(updatedTask);

		await service.initialize();
		(service as any).processedReminders.add(reminderKey);

		emitter.trigger("file-updated", { path: taskPath });
		await flushPromises();

		expect((service as any).processedReminders.has(reminderKey)).toBe(false);
		expect((service as any).notificationQueue).toEqual([
			expect.objectContaining({
				taskPath,
				reminder,
				notifyAt: new Date("2026-03-22T14:35:00").getTime(),
			}),
		]);

		service.destroy();
	});
});
