import {
	getTaskListDropSegments,
	reconstructTaskListDropTarget,
	resolveTaskListInsertionSlot,
	type TaskListDropBaselineCard,
} from "../../../src/bases/taskListDragGeometry";

function card(path: string): HTMLElement {
	const element = document.createElement("div");
	element.dataset.taskPath = path;
	return element;
}

function baseline(
	path: string,
	groupKey: string | null,
	top: number,
	height = 20
): TaskListDropBaselineCard {
	return {
		path,
		groupKey,
		card: card(path),
		top,
		bottom: top + height,
		midpoint: top + height / 2,
	};
}

describe("taskListDragGeometry", () => {
	it("groups contiguous drop cards into group-key segments", () => {
		const first = baseline("one.md", "todo", 0);
		const second = baseline("two.md", "todo", 30);
		const third = baseline("three.md", "done", 80);
		const fourth = baseline("four.md", "todo", 120);

		const segments = getTaskListDropSegments([first, second, third, fourth]);

		expect(segments).toEqual([
			{ groupKey: "todo", cards: [first, second] },
			{ groupKey: "done", cards: [third] },
			{ groupKey: "todo", cards: [fourth] },
		]);
	});

	it("reconstructs before/after drop targets from insertion slots", () => {
		const segments = getTaskListDropSegments([
			baseline("one.md", null, 0),
			baseline("two.md", null, 30),
		]);

		expect(reconstructTaskListDropTarget(segments, 0, -1)).toEqual({
			taskPath: "one.md",
			above: true,
		});
		expect(reconstructTaskListDropTarget(segments, 0, 2)).toEqual({
			taskPath: "two.md",
			above: false,
		});
		expect(reconstructTaskListDropTarget(segments, 10, 0)).toBeNull();
	});

	it("resolves insertion slots inside the selected segment", () => {
		const first = baseline("one.md", "todo", 0);
		const second = baseline("two.md", "todo", 30);
		const third = baseline("three.md", "done", 100);
		const segments = getTaskListDropSegments([first, second, third]);

		expect(resolveTaskListInsertionSlot(segments, 5)).toEqual({
			groupKey: "todo",
			segmentIndex: 0,
			insertionIndex: 0,
			element: first.card,
			position: "before",
		});
		expect(resolveTaskListInsertionSlot(segments, 70)).toEqual({
			groupKey: "todo",
			segmentIndex: 0,
			insertionIndex: 2,
			element: second.card,
			position: "after",
		});
		expect(resolveTaskListInsertionSlot(segments, 105)).toEqual({
			groupKey: "done",
			segmentIndex: 1,
			insertionIndex: 0,
			element: third.card,
			position: "before",
		});
	});

	it("returns null when there are no segments", () => {
		expect(resolveTaskListInsertionSlot([], 20)).toBeNull();
	});
});
