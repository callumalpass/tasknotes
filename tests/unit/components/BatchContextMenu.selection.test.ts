import { BatchContextMenu } from "../../../src/components/BatchContextMenu";
import type { TaskInfo } from "../../../src/types";

describe("BatchContextMenu selection persistence", () => {
	it("keeps selection after applying a property edit", async () => {
		const task = {
			path: "selected.md",
			title: "Selected",
			status: "open",
		} as TaskInfo;
		const clearSelection = jest.fn();
		const exitSelectionMode = jest.fn();
		const updateProperty = jest.fn(async () => undefined);
		const onUpdate = jest.fn();
		const menu = {
			options: {
				plugin: {
					cacheManager: {
						getTaskInfo: jest.fn(async () => task),
					},
					taskService: { updateProperty },
					taskSelectionService: { clearSelection, exitSelectionMode },
				},
				selectedPaths: [task.path],
				onUpdate,
			},
		};

		await (BatchContextMenu.prototype as any).batchUpdateProperty.call(
			menu,
			"status",
			"done"
		);

		expect(updateProperty).toHaveBeenCalledWith(task, "status", "done");
		expect(clearSelection).not.toHaveBeenCalled();
		expect(exitSelectionMode).not.toHaveBeenCalled();
		expect(onUpdate).toHaveBeenCalled();
	});
});
