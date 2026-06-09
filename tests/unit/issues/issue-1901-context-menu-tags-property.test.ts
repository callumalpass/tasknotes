import { TFile } from "../../helpers/obsidian-runtime";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";
import { TaskService } from "../../../src/services/TaskService";

describe("Issue #1901: context-menu tag updates", () => {
	it("writes tag edits to tags instead of an undefined frontmatter property", async () => {
		const plugin = PluginFactory.createMockPlugin();
		const service = new TaskService(plugin);
		const task = TaskFactory.createTask({ path: "Tasks/tagged-task.md", tags: ["task"] });
		const file = new TFile(task.path);
		const frontmatter: Record<string, unknown> = { tags: ["task"] };
		const toUserFieldSpy = jest.spyOn(plugin.fieldMapper, "toUserField");

		plugin.app.vault.getAbstractFileByPath.mockReturnValue(file);
		plugin.cacheManager.getTaskInfo.mockResolvedValue(task);
		plugin.app.fileManager.processFrontMatter.mockImplementation(
			async (_file: TFile, update: (frontmatter: Record<string, unknown>) => void) => {
				update(frontmatter);
			}
		);

		await service.updateProperty(task, "tags", ["task", "blorp"]);

		expect(frontmatter.tags).toEqual(["task", "blorp"]);
		expect(frontmatter).not.toHaveProperty("undefined");
		expect(toUserFieldSpy).not.toHaveBeenCalledWith("tags");
	});

	it("keeps mapped snake-case TaskInfo properties on their configured frontmatter keys", async () => {
		const plugin = PluginFactory.createMockPlugin();
		const service = new TaskService(plugin);
		const task = TaskFactory.createTask({ path: "Tasks/recurring-task.md" });
		const file = new TFile(task.path);
		const frontmatter: Record<string, unknown> = {};

		plugin.app.vault.getAbstractFileByPath.mockReturnValue(file);
		plugin.cacheManager.getTaskInfo.mockResolvedValue(task);
		plugin.app.fileManager.processFrontMatter.mockImplementation(
			async (_file: TFile, update: (frontmatter: Record<string, unknown>) => void) => {
				update(frontmatter);
			}
		);

		await service.updateProperty(task, "recurrence_anchor", "completion");

		expect(frontmatter.recurrence_anchor).toBe("completion");
		expect(frontmatter).not.toHaveProperty("undefined");
	});
});
