import type { TaskInfo } from "../types";
import { stringifyUnknown } from "../utils/stringUtils";
import { buildBasesPathProperties } from "./basesViewAdapters";
import type { BasesDataItem } from "./helpers";

export type TaskListGroupEntry = {
	file?: { path?: string };
};

export type TaskListGroup = {
	key: unknown;
	entries: TaskListGroupEntry[];
};

export type TaskListPrimaryHeaderItem = {
	type: "primary-header";
	groupKey: string;
	groupTitle: string;
	taskCount: number;
	groupEntries: TaskListGroupEntry[];
	isCollapsed: boolean;
};

export type TaskListSubHeaderItem = {
	type: "sub-header";
	groupKey: string;
	subGroupKey: string;
	subGroupTitle: string;
	taskCount: number;
	isCollapsed: boolean;
	parentKey: string;
};

export type TaskListTaskItem = {
	type: "task";
	task: TaskInfo;
	groupKey: string;
	subGroupKey?: string;
};

export type TaskListHeaderItem = TaskListPrimaryHeaderItem | TaskListSubHeaderItem;
export type TaskListRenderItem = TaskListHeaderItem | TaskListTaskItem;
export type TaskListVirtualItem = TaskInfo | TaskListRenderItem;

type BasesDisplayValue = {
	constructor?: { name?: string };
	isTruthy?: () => boolean;
	value?: unknown[];
	toString(): string;
};

export function buildTaskListPathProperties(
	dataItems: readonly BasesDataItem[]
): Map<string, Record<string, unknown>> {
	return buildBasesPathProperties(dataItems);
}

export function getTaskListPropertyValue(
	props: Record<string, unknown>,
	propertyId: string
): unknown {
	if (!propertyId) return null;

	if (propertyId.startsWith("formula.")) {
		return props[propertyId] ?? null;
	}

	const cleanPropertyId = propertyId.replace(/^(note\.|task\.|file\.)/, "");
	return props[cleanPropertyId] ?? null;
}

export function stringifyTaskListGroupValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "None";
	}

	if (typeof value === "object" && value !== null && typeof value.toString === "function") {
		const basesValue = value as BasesDisplayValue;
		if (
			basesValue.constructor?.name === "NullValue" ||
			(basesValue.isTruthy && !basesValue.isTruthy())
		) {
			return "None";
		}

		if (basesValue.constructor?.name === "ListValue" || Array.isArray(basesValue.value)) {
			const arr = basesValue.value || [];
			return arr.length > 0
				? arr.map((item) => stringifyTaskListGroupValue(item)).join(", ")
				: "None";
		}

		return basesValue.toString() || "None";
	}

	if (typeof value === "string") {
		return value || "None";
	}

	if (typeof value === "number") {
		return String(value);
	}

	if (typeof value === "boolean") {
		return value ? "True" : "False";
	}

	if (Array.isArray(value)) {
		return value.length > 0
			? value.map((item) => stringifyTaskListGroupValue(item)).join(", ")
			: "None";
	}

	return stringifyUnknown(value) || "None";
}

export function groupTasksByTaskListSubProperty(
	tasks: readonly TaskInfo[],
	propertyId: string,
	pathToProps: ReadonlyMap<string, Record<string, unknown>>
): Map<string, TaskInfo[]> {
	const subGroups = new Map<string, TaskInfo[]>();

	for (const task of tasks) {
		const props = pathToProps.get(task.path) || {};
		const subValue = getTaskListPropertyValue(props, propertyId);
		const subKey = stringifyTaskListGroupValue(subValue);
		const subTasks = subGroups.get(subKey) || [];
		subTasks.push(task);
		subGroups.set(subKey, subTasks);
	}

	return subGroups;
}

export function buildTaskListGroupedScopePaths(
	groups: readonly TaskListGroup[],
	taskNotes: readonly TaskInfo[],
	convertGroupKeyToString: (key: unknown) => string
): Map<string | null, string[]> {
	const taskPaths = new Set(taskNotes.map((task) => task.path));
	const groupedPaths = new Map<string | null, string[]>();

	for (const group of groups) {
		const groupKey = convertGroupKeyToString(group.key);
		const paths = group.entries
			.map((entry) => entry.file?.path)
			.filter((path: string | undefined): path is string => !!path && taskPaths.has(path));
		groupedPaths.set(groupKey, paths);
	}

	return groupedPaths;
}

export function buildTaskListSubPropertyScopePaths(
	groupedTasks: ReadonlyMap<string, readonly TaskInfo[]>
): Map<string | null, string[]> {
	const groupedPaths = new Map<string | null, string[]>();

	for (const [groupKey, tasks] of groupedTasks) {
		groupedPaths.set(
			groupKey,
			tasks.map((task) => task.path)
		);
	}

	return groupedPaths;
}

export function buildTaskListGroupedRenderItems(options: {
	groups: readonly TaskListGroup[];
	taskNotes: readonly TaskInfo[];
	subGroupPropertyId: string | null;
	pathToProps: ReadonlyMap<string, Record<string, unknown>>;
	collapsedGroups: ReadonlySet<string>;
	collapsedSubGroups: ReadonlySet<string>;
	convertGroupKeyToString: (key: unknown) => string;
}): TaskListRenderItem[] {
	const items: TaskListRenderItem[] = [];

	for (const group of options.groups) {
		const primaryKey = options.convertGroupKeyToString(group.key);
		const groupPaths = new Set(group.entries.map((entry) => entry.file?.path));
		const groupTasks = options.taskNotes.filter((task) => groupPaths.has(task.path));

		if (groupTasks.length === 0) continue;

		const isPrimaryCollapsed = options.collapsedGroups.has(primaryKey);
		items.push({
			type: "primary-header",
			groupKey: primaryKey,
			groupTitle: primaryKey,
			taskCount: groupTasks.length,
			groupEntries: group.entries,
			isCollapsed: isPrimaryCollapsed,
		});

		if (isPrimaryCollapsed) continue;

		if (options.subGroupPropertyId) {
			const subGroups = groupTasksByTaskListSubProperty(
				groupTasks,
				options.subGroupPropertyId,
				options.pathToProps
			);

			for (const [subKey, subTasks] of subGroups) {
				if (subTasks.length === 0) continue;

				const compoundKey = `${primaryKey}:${subKey}`;
				const isSubCollapsed = options.collapsedSubGroups.has(compoundKey);
				items.push({
					type: "sub-header",
					groupKey: primaryKey,
					subGroupKey: subKey,
					subGroupTitle: subKey,
					taskCount: subTasks.length,
					isCollapsed: isSubCollapsed,
					parentKey: primaryKey,
				});

				if (!isSubCollapsed) {
					for (const task of subTasks) {
						items.push({
							type: "task",
							task,
							groupKey: primaryKey,
							subGroupKey: subKey,
						});
					}
				}
			}
			continue;
		}

		for (const task of groupTasks) {
			items.push({ type: "task", task, groupKey: primaryKey });
		}
	}

	return items;
}

export function buildTaskListSubPropertyRenderItems(
	groupedTasks: ReadonlyMap<string, readonly TaskInfo[]>,
	collapsedGroups: ReadonlySet<string>
): TaskListRenderItem[] {
	const items: TaskListRenderItem[] = [];

	for (const [groupKey, tasks] of groupedTasks) {
		if (tasks.length === 0) continue;

		const isCollapsed = collapsedGroups.has(groupKey);
		items.push({
			type: "primary-header",
			groupKey,
			groupTitle: groupKey,
			taskCount: tasks.length,
			groupEntries: [],
			isCollapsed,
		});

		if (!isCollapsed) {
			for (const task of tasks) {
				items.push({ type: "task", task, groupKey });
			}
		}
	}

	return items;
}
