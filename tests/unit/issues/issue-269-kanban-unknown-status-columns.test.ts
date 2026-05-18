import { KanbanView } from "../../../src/bases/KanbanView";
import { StatusManager } from "../../../src/services/StatusManager";
import type { StatusConfig } from "../../../src/types";

const OPEN_STATUS: StatusConfig = {
	id: "open",
	value: "open",
	label: "Open",
	color: "#7c3aed",
	isCompleted: false,
	order: 1,
	autoArchive: false,
	autoArchiveDelay: 5,
};

const DONE_STATUS: StatusConfig = {
	id: "done",
	value: "done",
	label: "Done",
	color: "#16a34a",
	isCompleted: true,
	order: 2,
	autoArchive: false,
	autoArchiveDelay: 5,
};

function makePlugin() {
	const customStatuses = [OPEN_STATUS, DONE_STATUS];
	return {
		app: {
			metadataCache: {
				getFirstLinkpathDest: () => null,
				getFileCache: () => undefined,
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
		statusManager: new StatusManager(customStatuses, "open"),
		priorityManager: {
			getAllPriorities: () => [],
			normalizePriorityValue: (value: string) => value,
		},
		i18n: {
			translate: (key: string) => (key === "views.kanban.noTasks" ? "No tasks" : key),
		},
		settings: {
			customStatuses,
			fieldMapping: {
				sortOrder: "sort_order",
			},
		},
	};
}

function makeView(): KanbanView {
	const view = new KanbanView({}, document.createElement("div"), makePlugin() as any);
	(view as any).config = {
		get: jest.fn(() => undefined),
		getOrder: jest.fn(() => []),
		getDisplayName: jest.fn(() => undefined),
	};
	return view;
}

describe("Issue #269: unknown Kanban status columns", () => {
	it("marks status columns whose value is not defined in TaskNotes settings", async () => {
		const view = makeView();

		const column = await (view as any).createColumn("external-status", [], [], "status");

		expect(column.classList.contains("kanban-view__column--unknown-status")).toBe(true);
		expect(column.getAttribute("data-unknown-status")).toBe("external-status");
		expect(
			column
				.querySelector(".kanban-view__column-header")
				?.classList.contains("kanban-view__column-header--unknown-status")
		).toBe(true);
	});

	it("does not mark configured status columns", async () => {
		const view = makeView();

		const column = await (view as any).createColumn("open", [], [], "status");

		expect(column.classList.contains("kanban-view__column--unknown-status")).toBe(false);
		expect(
			column
				.querySelector(".kanban-view__column-header")
				?.classList.contains("kanban-view__column-header--unknown-status")
		).toBe(false);
	});
});
