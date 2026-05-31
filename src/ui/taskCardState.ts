import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { formatDateForStorage, getDatePart } from "../utils/dateUtils";
import { filterEmptyProjects, getEffectiveTaskStatus, sanitizeForCssClass } from "../utils/helpers";

export interface TaskCardStateOptions {
	targetDate?: Date;
	layout?: "default" | "compact" | "inline";
}

export interface TaskCardRenderState {
	targetDate: Date;
	effectiveStatus: string;
	layout: "default" | "compact" | "inline";
	isCompleted: boolean;
	isSkipped: boolean;
	isRecurring: boolean;
	isMaterializedOccurrence: boolean;
	isActivelyTracked: boolean;
	hasDetails: boolean;
	cardClasses: string[];
}

function createUTCDateFromStorageDate(datePart: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
	if (!match) {
		return null;
	}

	const [, year, month, day] = match;
	return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function getTodayTaskCardTargetDate(): Date {
	const todayLocal = new Date();
	return new Date(
		Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate())
	);
}

export function getDefaultTaskCardTargetDate(task: TaskInfo): Date {
	if (task.recurrence && task.recurrence_anchor !== "completion" && task.scheduled) {
		const scheduledDate = createUTCDateFromStorageDate(getDatePart(task.scheduled));
		if (scheduledDate) {
			return scheduledDate;
		}
	}

	return getTodayTaskCardTargetDate();
}

export function taskHasDetails(task: TaskInfo, plugin?: TaskNotesPlugin): boolean {
	if (typeof task.details === "string") {
		return task.details.trim().length > 0;
	}

	if (!plugin || !task.path) {
		return false;
	}

	const sections = plugin.app.metadataCache.getCache?.(task.path)?.sections;
	if (!sections) {
		return false;
	}

	return sections.some((section) => section.type !== "yaml");
}

export function shouldStrikeThroughCompletedTasks(plugin: TaskNotesPlugin): boolean {
	return plugin.settings?.showCompletedTaskStrikethrough !== false;
}

export function getProjectClassNames(task: TaskInfo): string[] {
	const classNames = new Set<string>();
	for (const project of filterEmptyProjects(task.projects || [])) {
		const sanitizedProject = sanitizeForCssClass(project);
		if (sanitizedProject) {
			classNames.add(`task-card--project-${sanitizedProject}`);
		}
	}
	return Array.from(classNames);
}

function buildTaskCardClassNames(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	state: Omit<TaskCardRenderState, "cardClasses">
): string[] {
	const cardClasses = ["task-card"];

	if (state.layout !== "default") {
		cardClasses.push(`task-card--layout-${state.layout}`);
	}

	if (state.isCompleted) cardClasses.push("task-card--completed");
	if (state.isCompleted && shouldStrikeThroughCompletedTasks(plugin)) {
		cardClasses.push("task-card--completed-strikethrough");
	}
	if (state.isSkipped) cardClasses.push("task-card--skipped");
	if (task.archived) cardClasses.push("task-card--archived");
	if (state.isActivelyTracked) cardClasses.push("task-card--actively-tracked");
	if (state.isRecurring) cardClasses.push("task-card--recurring");
	if (state.isMaterializedOccurrence) cardClasses.push("task-card--materialized-occurrence");
	if (state.hasDetails) cardClasses.push("task-card--has-details");

	if (task.priority) {
		cardClasses.push(`task-card--priority-${sanitizeForCssClass(task.priority)}`);
	}

	if (state.effectiveStatus) {
		cardClasses.push(`task-card--status-${sanitizeForCssClass(state.effectiveStatus)}`);
	}

	if (plugin.settings?.subtaskChevronPosition === "left") {
		cardClasses.push("task-card--chevron-left");
	}

	const projectClassNames = getProjectClassNames(task);
	if (projectClassNames.length > 0) {
		cardClasses.push("task-card--has-projects", ...projectClassNames);
	}

	return cardClasses;
}

export function buildTaskCardRenderState(
	task: TaskInfo,
	plugin: TaskNotesPlugin,
	options: TaskCardStateOptions = {}
): TaskCardRenderState {
	const targetDate = options.targetDate || getDefaultTaskCardTargetDate(task);
	const effectiveStatus = task.recurrence
		? getEffectiveTaskStatus(task, targetDate, plugin.statusManager.getCompletedStatuses()[0])
		: task.status;
	const layout = options.layout || "default";
	const isCompleted = task.recurrence
		? task.complete_instances?.includes(formatDateForStorage(targetDate)) || false
		: plugin.statusManager.isCompletedStatus(effectiveStatus);
	const isSkipped = task.recurrence
		? task.skipped_instances?.includes(formatDateForStorage(targetDate)) || false
		: false;
	const stateWithoutClasses = {
		targetDate,
		effectiveStatus,
		layout,
		isCompleted,
		isSkipped,
		isRecurring: !!task.recurrence,
		isMaterializedOccurrence: !!(task.recurrence_parent && task.occurrence_date),
		isActivelyTracked: plugin.getActiveTimeSession(task) !== null,
		hasDetails: taskHasDetails(task, plugin),
	};

	return {
		...stateWithoutClasses,
		cardClasses: buildTaskCardClassNames(task, plugin, stateWithoutClasses),
	};
}
