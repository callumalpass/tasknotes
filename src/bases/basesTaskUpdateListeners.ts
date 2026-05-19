import type { EventRef } from "obsidian";
import type { TaskInfo } from "../types";
import { EVENT_TASK_DELETED, EVENT_TASK_UPDATED } from "../types";
import {
	planBasesTaskUpdatedEvent,
	type BasesTaskUpdateSource,
} from "./basesUpdateEvents";

type BasesEventSource = {
	on: (event: string, callback: (eventData: unknown) => void | Promise<void>) => EventRef;
	offref: (ref: EventRef) => void;
};

type HandleBasesTaskUpdatedEventOptions = {
	eventData: unknown;
	isConnected: () => boolean;
	relevantPathsCache: Set<string>;
	handleTaskUpdate: (task: TaskInfo, source: BasesTaskUpdateSource) => Promise<void>;
	debouncedRefresh: () => void;
	onError: (error: unknown) => void;
};

type RegisterBasesTaskUpdateListenersOptions = {
	emitter: BasesEventSource;
	isConnected: () => boolean;
	relevantPathsCache: Set<string>;
	handleTaskUpdate: (task: TaskInfo, source: BasesTaskUpdateSource) => Promise<void>;
	handleTaskDeleted: (eventData: unknown) => void;
	debouncedRefresh: () => void;
	onError: (error: unknown) => void;
};

export async function handleBasesTaskUpdatedEvent({
	eventData,
	isConnected,
	relevantPathsCache,
	handleTaskUpdate,
	debouncedRefresh,
	onError,
}: HandleBasesTaskUpdatedEventOptions): Promise<void> {
	try {
		if (!isConnected()) return;

		const updatePlan = planBasesTaskUpdatedEvent(eventData, relevantPathsCache);
		if (updatePlan.action === "refresh-view") {
			debouncedRefresh();
			return;
		}
		if (updatePlan.action === "refresh-renamed-task") {
			relevantPathsCache.delete(updatePlan.removePath);
			relevantPathsCache.add(updatePlan.addPath);
			debouncedRefresh();
			return;
		}
		if (updatePlan.action === "handle-task") {
			await handleTaskUpdate(updatePlan.task, updatePlan.source);
		}
	} catch (error) {
		onError(error);
		debouncedRefresh();
	}
}

export function registerBasesTaskUpdateListeners({
	emitter,
	isConnected,
	relevantPathsCache,
	handleTaskUpdate,
	handleTaskDeleted,
	debouncedRefresh,
	onError,
}: RegisterBasesTaskUpdateListenersOptions): EventRef[] {
	const taskUpdatedListener = emitter.on(EVENT_TASK_UPDATED, (eventData: unknown) =>
		handleBasesTaskUpdatedEvent({
			eventData,
			isConnected,
			relevantPathsCache,
			handleTaskUpdate,
			debouncedRefresh,
			onError,
		})
	);
	const taskDeletedListener = emitter.on(EVENT_TASK_DELETED, (eventData: unknown) => {
		handleTaskDeleted(eventData);
	});
	const fileDeletedListener = emitter.on("file-deleted", (eventData: unknown) => {
		handleTaskDeleted(eventData);
	});

	return [taskUpdatedListener, taskDeletedListener, fileDeletedListener];
}

export function cleanupBasesTaskUpdateListeners(
	emitter: BasesEventSource,
	listeners: readonly EventRef[]
): void {
	for (const listener of listeners) {
		emitter.offref(listener);
	}
}
