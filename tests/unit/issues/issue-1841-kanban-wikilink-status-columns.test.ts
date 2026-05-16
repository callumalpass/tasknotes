import { KanbanView } from "../../../src/bases/KanbanView";
import { StatusManager } from "../../../src/services/StatusManager";
import type { StatusConfig, TaskInfo } from "../../../src/types";

const WIKILINK_STATUS: StatusConfig = {
	id: "inbox",
	value: "[[Inbox]]",
	label: "[[Inbox]]",
	color: "#ffaa00",
	isCompleted: false,
	order: 1,
	autoArchive: false,
	autoArchiveDelay: 5,
};

function makePlugin() {
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
		statusManager: new StatusManager([WIKILINK_STATUS], WIKILINK_STATUS.value),
		priorityManager: {
			getAllPriorities: () => [],
		},
		settings: {
			customStatuses: [WIKILINK_STATUS],
			fieldMapping: {
				sortOrder: "sort_order",
			},
		},
	};
}

function makeViewWithStatusGroup(rawGroupKey: string, task: TaskInfo): KanbanView {
	const view = new KanbanView({}, document.createElement("div"), makePlugin() as any);
	(view as any).dataAdapter = {
		getGroupedData: () => [
			{
				key: rawGroupKey,
				entries: [{ file: { path: task.path } }],
			},
		],
		convertGroupKeyToString: (key: unknown) => String(key),
		getSortConfig: () => [],
	};
	return view;
}

describe("Issue #1841: Kanban wikilink status columns", () => {
	it("merges Bases display labels with matching wikilink status values", () => {
		const task = {
			title: "Task in inbox",
			status: WIKILINK_STATUS.value,
			path: "Tasks/inbox.md",
		} as TaskInfo;
		const view = makeViewWithStatusGroup("Inbox", task);

		const groups = (view as any).groupTasks([task], "status", new Map());

		expect(Array.from(groups.keys())).toEqual([WIKILINK_STATUS.value]);
		expect(groups.get(WIKILINK_STATUS.value)).toEqual([task]);
	});

	it("renders the merged wikilink status header as an internal link", () => {
		const view = makeViewWithStatusGroup("Inbox", {
			title: "Task in inbox",
			status: WIKILINK_STATUS.value,
			path: "Tasks/inbox.md",
		} as TaskInfo);
		(view as any).basesController = {
			query: {
				views: [{ name: "Main", groupBy: "status" }],
			},
			viewName: "Main",
		};
		const container = document.createElement("div");

		(view as any).renderGroupTitleWrapper(container, WIKILINK_STATUS.value);

		const link = container.querySelector<HTMLAnchorElement>("a.internal-link.task-group-link");
		expect(link).not.toBeNull();
		expect(link?.textContent).toBe("Inbox");
		expect(link?.getAttribute("data-href")).toBe("Inbox");
	});
});
