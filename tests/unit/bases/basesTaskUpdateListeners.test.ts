import type { EventRef } from "obsidian";
import {
	cleanupBasesTaskUpdateListeners,
	handleBasesTaskUpdatedEvent,
	registerBasesTaskUpdateListeners,
} from "../../../src/bases/basesTaskUpdateListeners";
import { EVENT_TASK_DELETED, EVENT_TASK_UPDATED } from "../../../src/types";
import { TaskFactory } from "../../helpers/mock-factories";

function createEmitter() {
	const listeners = new Map<string, (eventData: unknown) => void | Promise<void>>();
	const refs = new Map<EventRef, string>();
	let nextId = 0;

	return {
		listeners,
		on: jest.fn((event: string, callback: (eventData: unknown) => void | Promise<void>) => {
			listeners.set(event, callback);
			const ref = { id: ++nextId, event } as unknown as EventRef;
			refs.set(ref, event);
			return ref;
		}),
		offref: jest.fn((ref: EventRef) => {
			const event = refs.get(ref);
			if (event) listeners.delete(event);
		}),
	};
}

describe("Bases task update listeners", () => {
	it("ignores task updates while the view is disconnected", async () => {
		const handleTaskUpdate = jest.fn();

		await handleBasesTaskUpdatedEvent({
			eventData: { updatedTask: TaskFactory.createTask({ path: "TaskNotes/A.md" }) },
			isConnected: () => false,
			relevantPathsCache: new Set(["TaskNotes/A.md"]),
			handleTaskUpdate,
			debouncedRefresh: jest.fn(),
			onError: jest.fn(),
		});

		expect(handleTaskUpdate).not.toHaveBeenCalled();
	});

	it("handles relevant task updates", async () => {
		const task = TaskFactory.createTask({ path: "TaskNotes/A.md" });
		const handleTaskUpdate = jest.fn().mockResolvedValue(undefined);

		await handleBasesTaskUpdatedEvent({
			eventData: { updatedTask: task },
			isConnected: () => true,
			relevantPathsCache: new Set([task.path]),
			handleTaskUpdate,
			debouncedRefresh: jest.fn(),
			onError: jest.fn(),
		});

		expect(handleTaskUpdate).toHaveBeenCalledWith(task, "tasknotes-service");
	});

	it("refreshes and swaps cached paths for renamed tasks", async () => {
		const cache = new Set(["TaskNotes/Old.md"]);
		const debouncedRefresh = jest.fn();

		await handleBasesTaskUpdatedEvent({
			eventData: {
				originalTask: TaskFactory.createTask({ path: "TaskNotes/Old.md" }),
				updatedTask: TaskFactory.createTask({ path: "TaskNotes/New.md" }),
			},
			isConnected: () => true,
			relevantPathsCache: cache,
			handleTaskUpdate: jest.fn(),
			debouncedRefresh,
			onError: jest.fn(),
		});

		expect(cache.has("TaskNotes/Old.md")).toBe(false);
		expect(cache.has("TaskNotes/New.md")).toBe(true);
		expect(debouncedRefresh).toHaveBeenCalledTimes(1);
	});

	it("refreshes for untracked TaskNotes service changes that can alter query membership", async () => {
		const createdTask = TaskFactory.createTask({ path: "TaskNotes/New.md" });
		const handleTaskUpdate = jest.fn();
		const debouncedRefresh = jest.fn();

		await handleBasesTaskUpdatedEvent({
			eventData: { path: createdTask.path, updatedTask: createdTask },
			isConnected: () => true,
			relevantPathsCache: new Set(["TaskNotes/Visible.md"]),
			handleTaskUpdate,
			debouncedRefresh,
			onError: jest.fn(),
		});

		expect(handleTaskUpdate).not.toHaveBeenCalled();
		expect(debouncedRefresh).toHaveBeenCalledTimes(1);
	});

	it("ignores untracked metadata-cache task updates", async () => {
		const task = TaskFactory.createTask({ path: "TaskNotes/Hidden.md" });
		const handleTaskUpdate = jest.fn();
		const debouncedRefresh = jest.fn();

		await handleBasesTaskUpdatedEvent({
			eventData: { path: task.path, task, taskInfo: task, updatedTask: task },
			isConnected: () => true,
			relevantPathsCache: new Set(["TaskNotes/Visible.md"]),
			handleTaskUpdate,
			debouncedRefresh,
			onError: jest.fn(),
		});

		expect(handleTaskUpdate).not.toHaveBeenCalled();
		expect(debouncedRefresh).not.toHaveBeenCalled();
	});

	it("logs and refreshes when task update handling fails", async () => {
		const error = new Error("update failed");
		const onError = jest.fn();
		const debouncedRefresh = jest.fn();

		await handleBasesTaskUpdatedEvent({
			eventData: { updatedTask: TaskFactory.createTask({ path: "TaskNotes/A.md" }) },
			isConnected: () => true,
			relevantPathsCache: new Set(["TaskNotes/A.md"]),
			handleTaskUpdate: jest.fn().mockRejectedValue(error),
			debouncedRefresh,
			onError,
		});

		expect(onError).toHaveBeenCalledWith(error);
		expect(debouncedRefresh).toHaveBeenCalledTimes(1);
	});

	it("registers update/delete listeners and cleans them up", async () => {
		const emitter = createEmitter();
		const handleTaskUpdate = jest.fn().mockResolvedValue(undefined);
		const handleTaskDeleted = jest.fn();
		const task = TaskFactory.createTask({ path: "TaskNotes/A.md" });

		const refs = registerBasesTaskUpdateListeners({
			emitter,
			isConnected: () => true,
			relevantPathsCache: new Set([task.path]),
			handleTaskUpdate,
			handleTaskDeleted,
			debouncedRefresh: jest.fn(),
			onError: jest.fn(),
		});

		expect(emitter.on).toHaveBeenCalledWith(EVENT_TASK_UPDATED, expect.any(Function));
		expect(emitter.on).toHaveBeenCalledWith(EVENT_TASK_DELETED, expect.any(Function));
		expect(emitter.on).toHaveBeenCalledWith("file-deleted", expect.any(Function));
		expect(refs).toHaveLength(3);

		await emitter.listeners.get(EVENT_TASK_UPDATED)?.({ updatedTask: task });
		emitter.listeners.get(EVENT_TASK_DELETED)?.({ path: "TaskNotes/A.md" });
		emitter.listeners.get("file-deleted")?.({ path: "TaskNotes/B.md" });

		expect(handleTaskUpdate).toHaveBeenCalledWith(task, "tasknotes-service");
		expect(handleTaskDeleted).toHaveBeenCalledTimes(2);

		cleanupBasesTaskUpdateListeners(emitter, refs);
		expect(emitter.offref).toHaveBeenCalledTimes(3);
		expect(emitter.listeners.size).toBe(0);
	});
});
