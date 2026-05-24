import { TFile } from "../../__mocks__/obsidian";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { TaskService } from "../../../src/services/TaskService";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

describe("Issue #1938: API partial updates preserve frontmatter tags", () => {
	it("normalizes hash-prefixed tags when mapping Obsidian frontmatter into TaskInfo", () => {
		const fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);

		const task = fieldMapper.mapFromFrontmatter(
			{
				title: "Repro",
				status: "open",
				tags: ["#task", "#WNL/IT", "task"],
			},
			"Tasks/repro.md"
		);

		expect(task.tags).toEqual(["task", "WNL/IT"]);
	});

	it("does not duplicate hash-prefixed tags during partial task updates", async () => {
		const plugin = PluginFactory.createMockPlugin();
		const service = new TaskService(plugin);
		const task = TaskFactory.createTask({
			path: "Tasks/repro.md",
			tags: ["#task", "#WNL/IT"],
			scheduled: "2026-06-01T09:00",
		});
		const file = new TFile(task.path);
		const frontmatter: Record<string, unknown> = {
			title: "repro",
			tags: ["#task", "#WNL/IT"],
			status: "open",
			scheduled: "2026-06-01T09:00",
		};

		plugin.app.vault.getAbstractFileByPath.mockReturnValue(file);
		plugin.app.fileManager.processFrontMatter.mockImplementation(
			async (_file: TFile, update: (target: Record<string, unknown>) => void) => {
				update(frontmatter);
			}
		);

		const updatedTask = await service.updateTask(task, {
			scheduled: "2026-06-02T09:00",
		});

		expect(frontmatter.tags).toEqual(["task", "WNL/IT"]);
		expect(updatedTask.tags).toEqual(["task", "WNL/IT"]);
		expect(frontmatter.scheduled).toBe("2026-06-02T09:00");
	});
});
