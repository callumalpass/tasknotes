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

function makeView(store: Record<string, unknown> = {}): KanbanView {
	const view = new KanbanView({}, document.createElement("div"), makePlugin() as any);
	(view as any).config = {
		get: jest.fn((key: string) => store[key]),
		set: jest.fn((key: string, value: unknown) => {
			store[key] = value;
		}),
		getOrder: jest.fn(() => []),
		getDisplayName: jest.fn(() => undefined),
	};
	(view as any).readViewOptions();
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

		toggle?.click();

		expect(column.classList.contains("kanban-view__column--collapsed")).toBe(false);
		expect(toggle?.getAttribute("aria-expanded")).toBe("true");
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

	it("saves collapsed columns in the view config so a reloaded view restores them (#2484)", async () => {
		const store: Record<string, unknown> = {};
		const sourceView = makeView(store);
		const toggle = (await createColumn(sourceView, "open")).querySelector<HTMLButtonElement>(
			".kanban-view__column-collapse-button"
		)!;
		toggle.click();
		expect(JSON.parse(store.collapsedColumns as string)).toEqual({ status: ["open"] });

		const reloadedView = makeView(store);
		const restored = await createColumn(reloadedView, "open");
		const other = await createColumn(reloadedView, "done");
		const sameValueOtherProperty = await (reloadedView as any).createColumn(
			"open",
			[],
			[],
			"priority"
		);
		expect(restored.dataset.collapsed).toBe("true");
		expect(restored.style.width).toContain("48px");
		expect(restored.querySelector("button")?.getAttribute("aria-expanded")).toBe("false");
		expect(other.dataset.collapsed).toBe("false");
		expect(sameValueOtherProperty.dataset.collapsed).toBe("false");

		toggle.click();
		expect(JSON.parse(store.collapsedColumns as string)).toEqual({});
	});

	it("ignores malformed collapsed column config", async () => {
		const view = makeView({ collapsedColumns: "{not json" });
		const column = await createColumn(view, "open");
		expect(column.dataset.collapsed).toBe("false");
	});
});
