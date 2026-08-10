import {
	buildKanbanTaskGroups,
	canonicalizeKanbanConfiguredGroupKey,
	getKanbanStatusGroupKeyAliases,
	isKanbanPriorityGroupingProperty,
	isKanbanStatusGroupingProperty,
} from "../../../src/bases/kanbanGrouping";
import type { PriorityConfig, StatusConfig, TaskInfo } from "../../../src/types";

function status(value: string, label = value): StatusConfig {
	return {
		id: value,
		value,
		label,
		color: "#ffffff",
		isCompleted: false,
		order: 1,
		autoArchive: false,
		autoArchiveDelay: 0,
	};
}

function priority(value: string, weight = 1): PriorityConfig {
	return {
		id: value,
		value,
		label: value,
		color: "#ffffff",
		weight,
	};
}

function task(path: string, overrides: Partial<TaskInfo>): TaskInfo {
	return {
		title: path,
		path,
		status: "open",
		priority: "normal",
		contexts: [],
		projects: [],
		tags: ["task"],
		archived: false,
		...overrides,
	} as TaskInfo;
}

describe("Issue #2216: Kanban TaskNotes status and priority grouping", () => {
	it("groups task.status columns from TaskInfo when Bases reports the property as None", () => {
		const openTask = task("Tasks/open.md", { status: "open" });
		const doneTask = task("Tasks/done.md", { status: "done" });
		const statuses = [status("open", "Open"), status("done", "Done")];
		const aliases = (config: StatusConfig) => getKanbanStatusGroupKeyAliases(config);

		const groups = buildKanbanTaskGroups({
			taskNotes: [openTask, doneTask],
			groupByPropertyId: "task.status",
			pathToProps: new Map(),
			explodeListColumns: false,
			groupedData: [
				{
					key: "None",
					entries: [
						{ file: { path: openTask.path } },
						{ file: { path: doneTask.path } },
					],
				},
			],
			convertGroupKeyToString: String,
			isListTypeProperty: () => false,
			getListPropertyValue: () => undefined,
			canonicalizeGroupKey: (groupKey, propertyId) =>
				canonicalizeKanbanConfiguredGroupKey({
					groupKey,
					propertyId,
					fields: { statusField: "status", priorityField: "priority" },
					statuses,
					normalizeStatusValue: (value) => value,
					normalizePriorityValue: (value) => value,
					getStatusGroupKeyAliases: aliases,
				}),
			statusConfigs: statuses,
			priorityConfigs: [],
			isStatusGroupingProperty: (propertyId) =>
				isKanbanStatusGroupingProperty(propertyId, "status"),
			isPriorityGroupingProperty: () => false,
			getStatusGroupKeyAliases: aliases,
			pinnedColumns: [],
		});

		expect(groups.get("open")?.map((item) => item.path)).toEqual([openTask.path]);
		expect(groups.get("done")?.map((item) => item.path)).toEqual([doneTask.path]);
		expect(groups.get("None") ?? []).toEqual([]);
	});

	it("handles Obsidian-normalized note.task.status group properties", () => {
		const openTask = task("Tasks/open.md", { status: "open" });
		const doneTask = task("Tasks/done.md", { status: "done" });
		const statuses = [status("open", "Open"), status("done", "Done")];
		const aliases = (config: StatusConfig) => getKanbanStatusGroupKeyAliases(config);

		const groups = buildKanbanTaskGroups({
			taskNotes: [openTask, doneTask],
			groupByPropertyId: "note.task.status",
			pathToProps: new Map(),
			explodeListColumns: false,
			groupedData: [
				{
					key: "None",
					entries: [
						{ file: { path: openTask.path } },
						{ file: { path: doneTask.path } },
					],
				},
			],
			convertGroupKeyToString: String,
			isListTypeProperty: () => false,
			getListPropertyValue: () => undefined,
			canonicalizeGroupKey: (groupKey, propertyId) =>
				canonicalizeKanbanConfiguredGroupKey({
					groupKey,
					propertyId,
					fields: { statusField: "status", priorityField: "priority" },
					statuses,
					normalizeStatusValue: (value) => value,
					normalizePriorityValue: (value) => value,
					getStatusGroupKeyAliases: aliases,
				}),
			statusConfigs: statuses,
			priorityConfigs: [],
			isStatusGroupingProperty: (propertyId) =>
				isKanbanStatusGroupingProperty(propertyId, "status"),
			isPriorityGroupingProperty: () => false,
			getStatusGroupKeyAliases: aliases,
			pinnedColumns: [],
		});

		expect(groups.get("open")?.map((item) => item.path)).toEqual([openTask.path]);
		expect(groups.get("done")?.map((item) => item.path)).toEqual([doneTask.path]);
		expect(groups.get("None") ?? []).toEqual([]);
	});

	it("groups mapped priority columns from TaskInfo instead of stale groupedData", () => {
		const highTask = task("Tasks/high.md", { priority: "high" });
		const lowTask = task("Tasks/low.md", { priority: "low" });
		const priorities = [priority("high", 0), priority("low", 2)];

		const groups = buildKanbanTaskGroups({
			taskNotes: [highTask, lowTask],
			groupByPropertyId: "task.priority",
			pathToProps: new Map(),
			explodeListColumns: false,
			groupedData: [
				{
					key: "None",
					entries: [
						{ file: { path: highTask.path } },
						{ file: { path: lowTask.path } },
					],
				},
			],
			convertGroupKeyToString: String,
			isListTypeProperty: () => false,
			getListPropertyValue: () => undefined,
			canonicalizeGroupKey: (groupKey, propertyId) =>
				canonicalizeKanbanConfiguredGroupKey({
					groupKey,
					propertyId,
					fields: { statusField: "status", priorityField: "priority" },
					statuses: [],
					normalizeStatusValue: (value) => value,
					normalizePriorityValue: (value) => value.toLowerCase(),
					getStatusGroupKeyAliases: () => new Set(),
				}),
			statusConfigs: [],
			priorityConfigs: priorities,
			isStatusGroupingProperty: () => false,
			isPriorityGroupingProperty: (propertyId) =>
				isKanbanPriorityGroupingProperty(propertyId, "priority"),
			getStatusGroupKeyAliases: () => new Set(),
			pinnedColumns: [],
		});

		expect(groups.get("high")?.map((item) => item.path)).toEqual([highTask.path]);
		expect(groups.get("low")?.map((item) => item.path)).toEqual([lowTask.path]);
		expect(groups.get("None") ?? []).toEqual([]);
	});
});
