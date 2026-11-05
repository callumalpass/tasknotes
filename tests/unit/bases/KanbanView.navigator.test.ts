import { KanbanView } from "../../../src/bases/KanbanView";

function navigator() {
	const view = new KanbanView({}, document.createElement("div"), {
		app: {},
		fieldMapper: { toUserField: (field: string) => field, isRecognizedProperty: () => true },
		priorityManager: { getAllPriorities: () => [] },
		settings: { customStatuses: [], fieldMapping: { sortOrder: "manual_order" } },
		i18n: { translate: (descriptor: { message: string }) => descriptor.message },
	} as any) as any;
	view.boardEl = document.createElement("div");
	view.columnNav = document.createElement("div");
	Object.defineProperty(view.columnNav, "offsetWidth", { value: 360 });
	view.columnSelect = document.createElement("select");
	view.previousColumn = document.createElement("button");
	view.nextColumn = document.createElement("button");
	const columns = (keys: string[]) => {
		view.boardEl.empty();
		keys.forEach((key, index) => {
			const column = view.boardEl.createDiv({ cls: "kanban-view__column", attr: { "data-group": key } });
			column.createSpan({ cls: "kanban-view__column-title", text: key });
			column.createSpan({ cls: "kanban-view__column-count", text: key === "none" ? "0" : "2" });
			if (key !== "none") column.createDiv({ cls: "task-card" });
			column.getBoundingClientRect = () => ({ left: index * 300 - view.boardEl.scrollLeft }) as DOMRect;
		});
	};
	return { view, columns };
}

it("initially aligns the first populated column while retaining empty options", () => {
	const { view, columns } = navigator();
	columns(["none", "open", "in-progress"]);
	view.updateColumnNavigator(true);
	expect(view.columnSelect.value).toBe("open");
	expect(view.boardEl.scrollLeft).toBe(300);
	expect(Array.from(view.columnSelect.options, (option: HTMLOptionElement) => option.value)).toEqual(["none", "open", "in-progress"]);
	expect(view.previousColumn.disabled).toBe(false);
});

it("derives selection from scroll and restores the same empty group after reordering", () => {
	const { view, columns } = navigator();
	columns(["none", "open"]);
	view.updateColumnNavigator(true);
	view.boardEl.scrollLeft = 0;
	view.updateColumnNavigator();
	expect(view.activeNavigatorColumn).toBe("none");
	expect(view.previousColumn.disabled).toBe(true);
	columns(["open", "none"]);
	view.updateColumnNavigator(true);
	expect(view.columnSelect.value).toBe("none");
	expect(view.boardEl.scrollLeft).toBe(300);
	expect(view.nextColumn.disabled).toBe(true);
});

it("falls back to a populated column if the selected group is removed", () => {
	const { view, columns } = navigator();
	view.activeNavigatorColumn = "removed";
	columns(["none", "open"]);
	view.updateColumnNavigator(true);
	expect(view.columnSelect.value).toBe("open");
	expect(view.activeNavigatorColumn).toBe("open");
});
