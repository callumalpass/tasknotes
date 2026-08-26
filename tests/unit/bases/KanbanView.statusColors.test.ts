import { KanbanView } from "../../../src/bases/KanbanView";
import { StatusManager } from "../../../src/services/StatusManager";
import type { StatusConfig } from "../../../src/types";

const OPEN_STATUS: StatusConfig = {
	id: "open",
	value: "open",
	label: "Open",
	color: "#7c3aed",
	icon: "lucide-circle",
	isCompleted: false,
	order: 1,
	autoArchive: false,
	autoArchiveDelay: 5,
};

const THEME_COLOR_STATUS: StatusConfig = {
	...OPEN_STATUS,
	id: "theme-color",
	value: "theme-color",
	label: "Theme color",
	color: "blue",
	order: 2,
};

const FUNCTION_COLOR_STATUS: StatusConfig = {
	...OPEN_STATUS,
	id: "function-color",
	value: "function-color",
	label: "Function color",
	color: "rgb(10 20 30)",
	order: 3,
};

const INVALID_COLOR_STATUS: StatusConfig = {
	...OPEN_STATUS,
	id: "invalid-color",
	value: "invalid-color",
	label: "Invalid color",
	color: "rgb(",
	order: 4,
};

const STATUSES = [
	OPEN_STATUS,
	THEME_COLOR_STATUS,
	FUNCTION_COLOR_STATUS,
	INVALID_COLOR_STATUS,
];

function makePlugin() {
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
				getLeaf: () => ({ openFile: jest.fn() }),
				openLinkText: jest.fn(),
			},
		},
		fieldMapper: {
			toUserField: (field: string) => field,
			isRecognizedProperty: () => true,
		},
		statusManager: new StatusManager(STATUSES, "open"),
		priorityManager: {
			getAllPriorities: () => [],
			normalizePriorityValue: (value: string) => value,
		},
		i18n: {
			translate: (key: string) => (key === "views.kanban.noTasks" ? "No tasks" : key),
		},
		settings: {
			customStatuses: STATUSES,
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

function expectStatusColor(
	element: Element | null,
	modifierClass: string,
	color = OPEN_STATUS.color
): void {
	expect(element).not.toBeNull();
	expect(element?.classList.contains(modifierClass)).toBe(true);
	expect((element as HTMLElement).style.getPropertyValue("--tn-kanban-status-color")).toBe(
		color
	);
}

function expectNoStatusColor(element: HTMLElement, modifierClass: string): void {
	expect(element.classList.contains(modifierClass)).toBe(false);
	expect(element.style.getPropertyValue("--tn-kanban-status-color")).toBe("");
}

describe("Kanban status colors", () => {
	const originalCss = window.CSS;

	beforeAll(() => {
		Object.defineProperty(window, "CSS", {
			configurable: true,
			value: {
				supports: (_property: string, value: string) => value !== INVALID_COLOR_STATUS.color,
			},
		});
	});

	afterAll(() => {
		Object.defineProperty(window, "CSS", {
			configurable: true,
			value: originalCss,
		});
	});

	it("marks only configured status-grouped flat columns with their status color", async () => {
		const view = makeView();

		const statusColumn = await (view as any).createColumn("open", [], [], "status");
		const projectColumn = await (view as any).createColumn("open", [], [], "projects");
		const unknownStatusColumn = await (view as any).createColumn(
			"external-status",
			[],
			[],
			"status"
		);
		const themeColorColumn = await (view as any).createColumn(
			"theme-color",
			[],
			[],
			"status"
		);
		const functionColorColumn = await (view as any).createColumn(
			"function-color",
			[],
			[],
			"status"
		);
		const invalidColorColumn = await (view as any).createColumn(
			"invalid-color",
			[],
			[],
			"status"
		);

		expectStatusColor(statusColumn, "kanban-view__column--status-colored");
		expectStatusColor(
			themeColorColumn,
			"kanban-view__column--status-colored",
			"var(--color-blue)"
		);
		expectStatusColor(
			functionColorColumn,
			"kanban-view__column--status-colored",
			FUNCTION_COLOR_STATUS.color
		);
		expectNoStatusColor(projectColumn, "kanban-view__column--status-colored");
		expectNoStatusColor(unknownStatusColumn, "kanban-view__column--status-colored");
		expectNoStatusColor(invalidColorColumn, "kanban-view__column--status-colored");
	});

	it("marks configured status swimlane headers and matching cells", async () => {
		const view = makeView();
		const board = document.createElement("div");
		(view as any).boardEl = board;
		(view as any).getVisibleProperties = jest.fn(() => []);
		(view as any).setupColumnHeaderDragHandlers = jest.fn();
		(view as any).setupSwimLaneCellDragDrop = jest.fn();
		(view as any).renderEmptyCellHint = jest.fn();
		(view as any).createAddTaskButton = jest.fn();

		await (view as any).renderSwimLaneTable(
			new Map([
				[
					"todo",
					new Map([
						["open", []],
						["external-status", []],
					]),
				],
			]),
			["open", "external-status"],
			new Map(),
			"status"
		);

		expectStatusColor(
			board.querySelector('[data-column-key="open"]'),
			"kanban-view__column-header-cell--status-colored"
		);
		expectStatusColor(
			board.querySelector('[data-column="open"]'),
			"kanban-view__swimlane-column--status-colored"
		);
		expectNoStatusColor(
			board.querySelector<HTMLElement>(
				'[data-column-key="external-status"]'
			) as HTMLElement,
			"kanban-view__column-header-cell--status-colored"
		);
		expectNoStatusColor(
			board.querySelector<HTMLElement>('[data-column="external-status"]') as HTMLElement,
			"kanban-view__swimlane-column--status-colored"
		);
	});
});
