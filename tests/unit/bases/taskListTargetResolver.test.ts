import { resolveTaskListTargetPaths } from "../../../src/bases/taskListTargetResolver";

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
