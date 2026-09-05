import {
	resolveTaskListDragPaths,
	resolveTaskListTargetPaths,
} from "../../../src/bases/taskListTargetResolver";

describe("resolveTaskListTargetPaths", () => {
	it("prefers selected paths over the focused task", () => {
		const selectionState = {
			getSelectedPaths: () => ["selected-a.md", "selected-b.md"],
		};

		expect(resolveTaskListTargetPaths(selectionState, "focused.md")).toEqual([
			"selected-a.md",
			"selected-b.md",
		]);
	});

	it("falls back to the focused path when selection is empty", () => {
		const selectionState = { getSelectedPaths: () => [] };

		expect(resolveTaskListTargetPaths(selectionState, "focused.md")).toEqual(["focused.md"]);
	});

	it("returns no targets when neither selection nor focus exists", () => {
		expect(resolveTaskListTargetPaths(undefined, null)).toEqual([]);
	});

	it("deduplicates selected paths while preserving selection order", () => {
		const selectionState = {
			getSelectedPaths: () => ["a.md", "b.md", "a.md", ""],
		};

		expect(resolveTaskListTargetPaths(selectionState, "focused.md")).toEqual(["a.md", "b.md"]);
	});
});

describe("resolveTaskListDragPaths", () => {
	const visiblePaths = new Set(["a.md", "b.md", "dragged.md"]);

	it("moves the visible selection when the dragged task is selected", () => {
		const selectionState = {
			isSelected: (path: string) => path === "dragged.md",
			getSelectedPaths: () => ["a.md", "hidden.md", "dragged.md", "a.md"],
		};

		expect(resolveTaskListDragPaths(selectionState, "dragged.md", visiblePaths)).toEqual([
			"a.md",
			"dragged.md",
		]);
	});

	it("moves only the dragged task when it is not selected", () => {
		const selectionState = {
			isSelected: () => false,
			getSelectedPaths: () => ["a.md", "b.md"],
		};

		expect(resolveTaskListDragPaths(selectionState, "dragged.md", visiblePaths)).toEqual([
			"dragged.md",
		]);
	});

	it("falls back to the dragged task if selection state is stale", () => {
		const selectionState = {
			isSelected: () => true,
			getSelectedPaths: () => ["hidden.md"],
		};

		expect(resolveTaskListDragPaths(selectionState, "dragged.md", visiblePaths)).toEqual([
			"dragged.md",
		]);
	});
});
