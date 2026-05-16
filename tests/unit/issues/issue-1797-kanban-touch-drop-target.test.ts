import { KanbanView } from "../../../src/bases/KanbanView";

function makeView(): KanbanView {
	return new KanbanView(
		{},
		document.createElement("div"),
		{
			app: {},
			fieldMapper: {
				toUserField: (field: string) => field,
				isRecognizedProperty: () => true,
			},
			priorityManager: {
				getAllPriorities: () => [],
			},
			settings: {
				customStatuses: [],
				fieldMapping: {
					sortOrder: "sort_order",
				},
			},
		} as any
	);
}

describe("issue #1797 Kanban touch drop targets", () => {
	let originalElementFromPoint: typeof document.elementFromPoint;

	beforeEach(() => {
		originalElementFromPoint = document.elementFromPoint;
	});

	afterEach(() => {
		document.elementFromPoint = originalElementFromPoint;
	});

	it("resolves a touched card into a same-column manual-order drop target", () => {
		const view = makeView();
		const column = document.createElement("div");
		column.dataset.group = "todo";
		const cards = column.createDiv("kanban-view__cards");
		const dragged = cards.createDiv("kanban-view__card-wrapper");
		dragged.dataset.taskPath = "tasks/a.md";
		const target = cards.createDiv("kanban-view__card-wrapper");
		target.dataset.taskPath = "tasks/b.md";
		target.getBoundingClientRect = jest.fn(
			() =>
				({
					top: 100,
					bottom: 140,
					height: 40,
					left: 0,
					right: 200,
					width: 200,
				}) as DOMRect
		);

		(view as any).draggedTaskPaths = ["tasks/a.md"];
		document.elementFromPoint = jest.fn(() => target);

		const dropAbove = (view as any).findDropTargetAt(50, 110);
		expect(dropAbove).toMatchObject({
			type: "task",
			groupKey: "todo",
			swimLaneKey: null,
			taskPath: "tasks/b.md",
			above: true,
			cardsContainer: cards,
		});

		const dropBelow = (view as any).findDropTargetAt(50, 135);
		expect(dropBelow).toMatchObject({
			type: "task",
			groupKey: "todo",
			taskPath: "tasks/b.md",
			above: false,
		});
	});
});
