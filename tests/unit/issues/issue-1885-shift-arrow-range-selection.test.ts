import { TaskSelectionService } from "../../../src/services/TaskSelectionService";

function createSelectionService(): TaskSelectionService {
	return new TaskSelectionService({} as never);
}

describe("Issue #1885: Shift+arrow range selection", () => {
	it("extends the selected range to the next visible task", () => {
		const service = createSelectionService();
		const visiblePaths = ["Tasks/a.md", "Tasks/b.md", "Tasks/c.md"];

		service.selectTask("Tasks/a.md");
		service.selectAdjacentRange(1, visiblePaths);
		service.selectAdjacentRange(1, visiblePaths);

		expect(service.getSelectedPaths()).toEqual(["Tasks/a.md", "Tasks/b.md", "Tasks/c.md"]);
	});

	it("extends the selected range to the previous visible task", () => {
		const service = createSelectionService();
		const visiblePaths = ["Tasks/a.md", "Tasks/b.md", "Tasks/c.md"];

		service.selectTask("Tasks/c.md");
		service.selectAdjacentRange(-1, visiblePaths);

		expect(service.getSelectedPaths()).toEqual(["Tasks/c.md", "Tasks/b.md"]);
	});

	it("uses the first visible task when selection mode has no active endpoint", () => {
		const service = createSelectionService();
		const visiblePaths = ["Tasks/a.md", "Tasks/b.md"];

		service.selectAdjacentRange(1, visiblePaths);

		expect(service.getSelectedPaths()).toEqual(["Tasks/a.md"]);
	});
});
