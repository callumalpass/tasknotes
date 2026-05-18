import type { TFile } from "obsidian";
import { EVENT_TASK_UPDATED } from "../../types";
import type { IWebhookNotifier, StatusConfig, TaskInfo } from "../../types";

export interface TaskPropertyChangeSideEffectsContext {
	cacheManager: {
		waitForFreshTaskData?: (file: TFile) => Promise<void>;
		updateTaskInfoInCache: (path: string, task: TaskInfo) => void;
		getBlockedTaskPaths: (path: string) => string[];
		getTaskInfo: (path: string) => Promise<TaskInfo | null | undefined>;
	};
	emitter: {
		trigger: (event: string, payload: unknown) => void;
	};
	statusManager: {
		isCompletedStatus: (status: string) => boolean;
		getStatusConfig: (status: string) => StatusConfig | undefined;
	};
	taskCalendarSyncService?: {
		isEnabled: () => boolean;
		completeTaskInCalendar: (task: TaskInfo) => Promise<unknown>;
		updateTaskInCalendar: (updatedTask: TaskInfo, originalTask: TaskInfo) => Promise<unknown>;
	};
	webhookNotifier?: IWebhookNotifier;
	autoArchiveService?: {
		scheduleAutoArchive: (task: TaskInfo, statusConfig: StatusConfig) => Promise<void>;
		cancelAutoArchive: (taskPath: string) => Promise<void>;
	};
	normalizeStatusValue: (value: unknown) => string;
}

export interface TaskPropertyChangeSideEffectsInput {
	file: TFile;
	originalTask: TaskInfo;
	updatedTask: TaskInfo;
	property: keyof TaskInfo;
	oldValue: unknown;
	newValue: unknown;
}

interface CompletionTransition {
	wasCompleted: boolean;
	isCompleted: boolean;
}

function getCompletionTransition(
	context: TaskPropertyChangeSideEffectsContext,
	property: keyof TaskInfo,
	oldValue: unknown,
	newValue: unknown
): CompletionTransition | null {
	if (property !== "status") {
		return null;
	}

	return {
		wasCompleted: context.statusManager.isCompletedStatus(
			context.normalizeStatusValue(oldValue)
		),
		isCompleted: context.statusManager.isCompletedStatus(
			context.normalizeStatusValue(newValue)
		),
	};
}

async function refreshCache(
	context: TaskPropertyChangeSideEffectsContext,
	input: TaskPropertyChangeSideEffectsInput
): Promise<void> {
	try {
		if (context.cacheManager.waitForFreshTaskData) {
			await context.cacheManager.waitForFreshTaskData(input.file);
		}
		context.cacheManager.updateTaskInfoInCache(input.originalTask.path, input.updatedTask);
	} catch (cacheError) {
		console.error("Error updating task cache:", {
			error: cacheError instanceof Error ? cacheError.message : String(cacheError),
			taskPath: input.originalTask.path,
		});
	}
}

async function emitTaskUpdateEvents(
	context: TaskPropertyChangeSideEffectsContext,
	input: TaskPropertyChangeSideEffectsInput
): Promise<void> {
	try {
		context.emitter.trigger(EVENT_TASK_UPDATED, {
			path: input.originalTask.path,
			originalTask: input.originalTask,
			updatedTask: input.updatedTask,
		});

		const transition = getCompletionTransition(
			context,
			input.property,
			input.oldValue,
			input.newValue
		);
		if (!transition || transition.wasCompleted === transition.isCompleted) {
			return;
		}

		const dependentTaskPaths = context.cacheManager.getBlockedTaskPaths(
			input.originalTask.path
		);

		for (const dependentPath of dependentTaskPaths) {
			try {
				const dependentTask = await context.cacheManager.getTaskInfo(dependentPath);
				if (dependentTask) {
					context.emitter.trigger(EVENT_TASK_UPDATED, {
						path: dependentPath,
						originalTask: dependentTask,
						updatedTask: dependentTask,
					});
				}
			} catch (dependentError) {
				console.error(
					`Error triggering update for dependent task ${dependentPath}:`,
					dependentError
				);
			}
		}
	} catch (eventError) {
		console.error("Error emitting task update event:", {
			error: eventError instanceof Error ? eventError.message : String(eventError),
			taskPath: input.originalTask.path,
		});
	}
}

async function triggerWebhookSideEffect(
	context: TaskPropertyChangeSideEffectsContext,
	input: TaskPropertyChangeSideEffectsInput
): Promise<void> {
	if (!context.webhookNotifier) {
		return;
	}

	try {
		const transition = getCompletionTransition(
			context,
			input.property,
			input.oldValue,
			input.newValue
		);

		if (transition && !transition.wasCompleted && transition.isCompleted) {
			await context.webhookNotifier.triggerWebhook("task.completed", {
				task: input.updatedTask,
			});
			return;
		}

		await context.webhookNotifier.triggerWebhook("task.updated", {
			task: input.updatedTask,
			previous: input.originalTask,
		});
	} catch (error) {
		console.warn("Failed to trigger webhook for property update:", error);
	}
}

function triggerCalendarSideEffect(
	context: TaskPropertyChangeSideEffectsContext,
	input: TaskPropertyChangeSideEffectsInput
): void {
	if (!context.taskCalendarSyncService?.isEnabled()) {
		return;
	}

	const transition = getCompletionTransition(
		context,
		input.property,
		input.oldValue,
		input.newValue
	);

	const syncPromise =
		transition && !transition.wasCompleted && transition.isCompleted
			? context.taskCalendarSyncService.completeTaskInCalendar(input.updatedTask)
			: context.taskCalendarSyncService.updateTaskInCalendar(
					input.updatedTask,
					input.originalTask
				);

	syncPromise.catch((error) => {
		console.warn("Failed to sync task update to Google Calendar:", error);
	});
}

async function updateAutoArchiveSideEffect(
	context: TaskPropertyChangeSideEffectsContext,
	input: TaskPropertyChangeSideEffectsInput
): Promise<void> {
	if (
		!context.autoArchiveService ||
		input.property !== "status" ||
		input.newValue === input.oldValue
	) {
		return;
	}

	try {
		const statusConfig = context.statusManager.getStatusConfig(input.newValue as string);
		if (!statusConfig) {
			return;
		}

		if (statusConfig.autoArchive) {
			await context.autoArchiveService.scheduleAutoArchive(
				input.updatedTask,
				statusConfig
			);
		} else {
			await context.autoArchiveService.cancelAutoArchive(input.updatedTask.path);
		}
	} catch (error) {
		console.warn("Failed to handle auto-archive for status property change:", error);
	}
}

export async function runTaskPropertyChangeSideEffects(
	context: TaskPropertyChangeSideEffectsContext,
	input: TaskPropertyChangeSideEffectsInput
): Promise<void> {
	await refreshCache(context, input);
	await emitTaskUpdateEvents(context, input);
	await triggerWebhookSideEffect(context, input);
	triggerCalendarSideEffect(context, input);
	await updateAutoArchiveSideEffect(context, input);
}
