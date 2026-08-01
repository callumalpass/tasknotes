import { convertBasesGroupKeyToString } from "../../../src/bases/basesValueConversion";
import { KanbanView } from "../../../src/bases/KanbanView";
import { applyKanbanColumnOrder } from "../../../src/bases/kanbanGrouping";
import { StatusManager } from "../../../src/services/StatusManager";
import type { StatusConfig, TaskInfo } from "../../../src/types";

const OPEN_STATUS: StatusConfig = {
	id: "open",
	value: "open",
	label: "Open",
	color: "#44aa99",
	icon: "lucide-circle",
	isCompleted: false,
	order: 1,
	autoArchive: false,
	autoArchiveDelay: 0,
};

const DONE_STATUS: StatusConfig = {
	id: "done",
	value: "done",
	label: "Done",
	color: "#44aa44",
	icon: "lucide-check",
	isCompleted: true,
	order: 2,
	autoArchive: false,
	autoArchiveDelay: 0,
};

function task(path: string, status = "open"): TaskInfo {
	return {
		title: path,
		status,
		priority: "normal",
		path,
		contexts: [],
		projects: [],
		tags: ["task"],
		archived: false,
	} as TaskInfo;
}

function richStatusValue(status: StatusConfig): Record<string, unknown> {
	return {
		icon: status.icon,
		color: status.color,
		value: status.value,
		label: status.label,
	};
}

function makePlugin() {
	const statusManager = new StatusManager([OPEN_STATUS, DONE_STATUS], OPEN_STATUS.value);

	return {
		app: {
			metadataCache: {
				getFirstLinkpathDest: () => null,
			},
			vault: {
				getAbstractFileByPath: () => null,
			},
			workspace: {
				getLeaf: () => ({
					openFile: jest.fn(),
				}),
				openLinkText: jest.fn(),
			},
		},
		fieldMapper: {
			toUserField: (field: string) => field,
			isRecognizedProperty: () => true,
		},
		statusManager,
		priorityManager: {
			getAllPriorities: () => [],
			getPriorityWeight: () => 0,
			normalizePriorityValue: (value: string) => value,
			getPriorityConfig: () => null,
		},
		settings: {
			customStatuses: [OPEN_STATUS, DONE_STATUS],
			fieldMapping: {
				sortOrder: "tasknotes_manual_order",
			},
		},
	};
}

function makeViewWithStatusGroup(rawGroupKey: unknown, taskInfo: TaskInfo): KanbanView {
	const view = new KanbanView({}, document.createElement("div"), makePlugin() as any);
	(view as any).dataAdapter = {
		getGroupedData: () => [
			{
				key: rawGroupKey,
				entries: [{ file: { path: taskInfo.path } }],
			},
		],
		convertGroupKeyToString: (key: unknown) => convertBasesGroupKeyToString(key),
		getSortConfig: () => [],
	};
	(view as any).basesController = {
		query: {
			views: [{ name: "Board", groupBy: { property: "task.status" } }],
		},
		viewName: "Board",
	};
	return view;
}

describe("Issue #2161: Kanban rich status group values", () => {
	it("canonicalizes Bases rich status group keys before building columns", () => {
		const openTask = task("Tasks/open.md", "open");
		const view = makeViewWithStatusGroup(richStatusValue(OPEN_STATUS), openTask);

		const groups = (view as any).groupTasks([openTask], "task.status", new Map());

		expect(Array.from(groups.keys())).toEqual(["open", "done"]);
		expect(groups.get("open")).toEqual([openTask]);
		expect(groups.has(JSON.stringify(richStatusValue(OPEN_STATUS)))).toBe(false);
	});

	it("renders the canonicalized status column title as the status label", () => {
		const openTask = task("Tasks/open.md", "open");
		const view = makeViewWithStatusGroup(richStatusValue(OPEN_STATUS), openTask);
		const container = document.createElement("div");

		(view as any).renderGroupTitleWrapper(container, "open");

		expect(container.textContent).toBe("Open");
	});

	it("keeps configured formula column order and pinned empty columns when read from config", () => {
		const ordered = applyKanbanColumnOrder({
			groupBy: "formula.weekDay",
			actualKeys: ["Friday", "Sunday", "Thursday", "Monday"],
			columnOrders: {
				"formula.weekDay": [
					"Monday",
					"Tuesday",
					"Wednesday",
					"Thursday",
					"Friday",
					"Saturday",
					"Sunday",
				],
			},
			hideEmptyColumns: false,
			pinnedColumns: ["Tuesday", "Wednesday", "Saturday"],
			isPriorityField: () => false,
			isStatusField: () => false,
			getPriorityWeight: () => 0,
			findStatusConfig: () => undefined,
		});

		expect(ordered).toEqual([
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
			"Sunday",
		]);
	});
});
