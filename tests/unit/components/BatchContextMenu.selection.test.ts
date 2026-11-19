import { updateTasksProperty } from "../../../src/bases/basesTaskCardActions";
import type { TaskInfo } from "../../../src/types";

describe("Batch keyboard action selection persistence", () => {
	it("keeps selection after applying a property edit", async () => {
		const task = { path: "selected.md", title: "Selected", status: "open" } as TaskInfo;
		const clearSelection = jest.fn();
		const exitSelectionMode = jest.fn();
		const updateTaskProperty = jest.fn(async () => undefined);
		const context = {
			plugin: { updateTaskProperty },
			taskSelectionService: { clearSelection, exitSelectionMode },
		};

		await updateTasksProperty(context as any, [task], "status", "done");

		expect(updateTaskProperty).toHaveBeenCalledWith(task, "status", "done");
		expect(clearSelection).not.toHaveBeenCalled();
		expect(exitSelectionMode).not.toHaveBeenCalled();
	});
});
