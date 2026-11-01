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
			getMapping: () => ({ sortOrder: "sort_order" }),
		},
		statusManager: new StatusManager([OPEN_STATUS], "open"),
		priorityManager: {
			getAllPriorities: () => [],
			getPriorityConfig: () => undefined,
			normalizePriorityValue: (value: string) => value,
		},
		i18n: {
			translate: (descriptor: { message: string }, variables?: Record<string, string>) =>
				descriptor.message.replace("{column}", variables?.column ?? "column"),
		},
		settings: {
			customStatuses: [OPEN_STATUS],
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

async function createColumn(view: KanbanView, groupKey = "open"): Promise<HTMLElement> {
	return (view as any).createColumn(groupKey, [], [], "status");
}

describe("Kanban column collapse state", () => {
	it("renders a dedicated accessible control that toggles only its flat column", async () => {
		const view = makeView();
		const column = await createColumn(view);
		const header = column.querySelector<HTMLElement>(".kanban-view__column-header");
		const toggle = column.querySelector<HTMLButtonElement>(
			".kanban-view__column-collapse-button"
		);
		const bubbledClick = jest.fn();
		header?.addEventListener("click", bubbledClick);

		expect(toggle).not.toBeNull();
		expect(toggle?.type).toBe("button");
		expect(toggle?.getAttribute("aria-expanded")).toBe("true");
		expect(toggle?.getAttribute("aria-label")).toBe("Toggle Open column");
		expect(column.classList.contains("kanban-view__column--collapsed")).toBe(false);

		toggle?.click();

		expect(column.classList.contains("kanban-view__column--collapsed")).toBe(true);
		expect(toggle?.getAttribute("aria-expanded")).toBe("false");
		expect(bubbledClick).not.toHaveBeenCalled();
		expect(view.getEphemeralState()).toEqual(
			expect.objectContaining({ collapsedColumns: [JSON.stringify(["status", "open"])] })
		);

		toggle?.click();

		expect(column.classList.contains("kanban-view__column--collapsed")).toBe(false);
		expect(toggle?.getAttribute("aria-expanded")).toBe("true");
		expect(view.getEphemeralState()).toEqual(
			expect.objectContaining({ collapsedColumns: [] })
		);
	});

	it("does not render collapse controls in swimlane column headers", async () => {
		const view = makeView();
		const board = document.createElement("div");
		(view as any).boardEl = board;
		(view as any).setupColumnHeaderDragHandlers = jest.fn();
		(view as any).setupSwimLaneCellDragDrop = jest.fn();
		(view as any).renderEmptyCellHint = jest.fn();
		(view as any).createAddTaskButton = jest.fn();

		await (view as any).renderSwimLaneTable(
			new Map([["todo", new Map([["open", []]])]]),
			["open"],
			new Map(),
			"status"
		);

		expect(board.querySelector(".kanban-view__column-header-cell")).not.toBeNull();
		expect(board.querySelector(".kanban-view__column-collapse-button")).toBeNull();
	});

	it("restores collapsed keys in a recreated view instance", async () => {
		const sourceView = makeView();
		const sourceColumn = await createColumn(sourceView, "open");
		sourceColumn.querySelector<HTMLButtonElement>(
			".kanban-view__column-collapse-button"
		)?.click();
		const savedState = {
			...sourceView.getEphemeralState(),
			collapsedColumns: [JSON.stringify(["status", "open"]), JSON.stringify(["status", "no-longer-rendered"])],
		};

		const restoredView = makeView();
		restoredView.setEphemeralState(savedState);
		const restoredColumn = await createColumn(restoredView, "open");
		const otherColumn = await createColumn(restoredView, "done");

		expect(restoredColumn.classList.contains("kanban-view__column--collapsed")).toBe(true);
		expect(
			restoredColumn
				.querySelector(".kanban-view__column-collapse-button")
				?.getAttribute("aria-expanded")
		).toBe("false");
		expect(otherColumn.classList.contains("kanban-view__column--collapsed")).toBe(false);
	});

	it("applies restored state to columns already rendered, including width and aria state", async () => {
		const view = makeView();
		const board = document.createElement("div");
		(view as any).boardEl = board;
		const column = await createColumn(view);
		board.appendChild(column);
		view.setEphemeralState({ collapsedColumns: [JSON.stringify(["status", "open"])] });
		expect(column.dataset.collapsed).toBe("true");
		expect(column.style.width).toContain("48px");
		expect(column.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
		view.setEphemeralState({ collapsedColumns: [] });
		expect(column.dataset.collapsed).toBe("false");
		expect(column.querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
	});

	it("does not reuse another grouping property's collapse state for the same value", async () => {
		const view = makeView();
		const status = await createColumn(view);
		status.querySelector<HTMLButtonElement>(".kanban-view__column-collapse-button")!.click();
		const other = await (view as any).createColumn("open", [], [], "priority");
		expect(other.dataset.collapsed).toBe("false");
		const restored = await createColumn(view);
		expect(restored.dataset.collapsed).toBe("true");
	});

	it("keeps a toggle performed while a refresh is pending", async () => {
		jest.useFakeTimers();
		try {
			const view = makeView();
			const column = await createColumn(view);
			(view as any).render = jest.fn().mockResolvedValue(undefined);
			(view as any).debouncedRefresh();
			column.querySelector<HTMLButtonElement>(".kanban-view__column-collapse-button")!.click();
			await jest.advanceTimersByTimeAsync(150);
			expect(view.getEphemeralState()).toEqual(expect.objectContaining({
				collapsedColumns: [JSON.stringify(["status", "open"])],
			}));
		} finally { jest.useRealTimers(); }
	});

	it("ignores malformed restored collapse state", async () => {
		const view = makeView();

		expect(() =>
			view.setEphemeralState({
				collapsedColumns: ["open", 42, null],
			})
		).not.toThrow();

		const column = await createColumn(view, "open");
		expect(column.classList.contains("kanban-view__column--collapsed")).toBe(false);
	});
});
