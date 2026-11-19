import { Notice } from "obsidian";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";
import { TaskService } from "../../../src/services/TaskService";
import { withVaultFileMutation } from "../../../src/services/VaultMutationService";
import TaskNotesPlugin from "../../../src/main";
import { createI18nService } from "../../../src/i18n";
import { createTaskNotesCommandDefinitions } from "../../../src/commands/taskNotesCommands";
import { showConfirmationModal } from "../../../src/modals/ConfirmationModal";
import type { TaskInfo } from "../../../src/types";
import { App, TFile } from "../../helpers/obsidian-runtime";

jest.mock("../../../src/modals/ConfirmationModal", () => ({
	showConfirmationModal: jest.fn(),
}));

const confirm = jest.mocked(showConfirmationModal);

function createPlugin(task: Partial<TaskInfo> = {}) {
	const completedTask = {
		path: "Tasks/review.md",
		title: "Review",
		status: "done",
		archived: false,
		completedDate: "2026-01-01",
		...task,
	} as TaskInfo;
	const plugin = new TaskNotesPlugin(new App() as never, {} as never);
	plugin.i18n = createI18nService();
	plugin.app.workspace.getActiveFile = jest.fn(() => new TFile(completedTask.path)) as never;
	plugin.cacheManager = { getTaskInfo: jest.fn(async () => completedTask) } as never;
	plugin.statusManager = { isCompletedStatus: jest.fn((status) => status === "done") } as never;
	plugin.taskService = { repeatTask: jest.fn(async () => ({ ...completedTask, status: "open" })) } as never;
	plugin.openTaskEditModal = jest.fn();
	return plugin;
}

describe("PR #2188: serialized checkbox reset", () => {
	it("uses latest bytes after a queued mutation, preserving frontmatter and body edits", async () => {
		const task = TaskFactory.createTask({ status: "done", completedDate: "2026-01-01" });
		const file = new TFile(task.path);
		const plugin = PluginFactory.createMockPlugin();
		plugin.settings.resetCheckboxesOnRecurrence = true;
		plugin.statusManager.isCompletedStatus = jest.fn(() => true);
		plugin.cacheManager.getTaskInfo = jest.fn(async () => task);
		plugin.app.vault.getAbstractFileByPath = jest.fn(() => file);
		let content = "---\nstatus: done\n---\n- [x] Original\n";
		plugin.app.vault.process = jest.fn(async (_file, update) => {
			content = update(content);
			return content;
		});
		const service = new TaskService(plugin);
		jest.spyOn(service, "updateTask").mockResolvedValue({ ...task, status: "open" });
		let release!: () => void;
		const queued = withVaultFileMutation(file, async () => {
			await new Promise<void>((done) => { release = done; });
			content = "---\nstatus: open\nexternal: kept\n---\n- [x] Original\n- [x] New edit\n";
		});
		await Promise.resolve();
		const repeating = service.repeatTask(task);
		await new Promise((done) => setTimeout(done, 0));
		expect(plugin.app.vault.process).not.toHaveBeenCalled();
		release();
		await queued;
		const result = await repeating;
		expect(content).toContain("external: kept");
		expect(content).toContain("status: open");
		expect(content).toContain("- [ ] New edit");
		expect(result.details).toContain("- [ ] Original");
		expect(plugin.app.vault.modify).not.toHaveBeenCalled();
	});
});

describe("PR #2188: repeat current task command", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		confirm.mockResolvedValue(true);
	});

	it("registers the command", async () => {
		const definition = createTaskNotesCommandDefinitions({} as TaskNotesPlugin)
			.find((command) => command.id === "repeat-current-task");
		const plugin = createPlugin();
		await definition?.callback?.(plugin);
		expect(plugin.taskService.repeatTask).toHaveBeenCalledTimes(1);
	});

	it("leaves everything unchanged when confirmation is cancelled", async () => {
		const plugin = createPlugin({ archived: true });
		confirm.mockResolvedValue(false);
		await plugin.repeatCurrentTask();
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(plugin.taskService.repeatTask).not.toHaveBeenCalled();
		expect(plugin.openTaskEditModal).not.toHaveBeenCalled();
	});

	it("waits for confirmation before repeating and opens the editor afterwards", async () => {
		const plugin = createPlugin();
		let resolve!: (confirmed: boolean) => void;
		confirm.mockReturnValue(new Promise((done) => { resolve = done; }));
		const pending = plugin.repeatCurrentTask();
		await new Promise((done) => setTimeout(done, 0));
		expect(plugin.taskService.repeatTask).not.toHaveBeenCalled();
		resolve(true);
		await pending;
		expect(plugin.openTaskEditModal).toHaveBeenCalledWith(expect.objectContaining({ status: "open" }));
		expect(confirm.mock.calls[0][1].message).toContain("cancelling that editor will not undo");
	});

	it.each([
		[{ recurrence: "FREQ=DAILY" }, "Recurring tasks already track each occurrence"],
		[{ recurrence_parent: "[[Tasks/parent]]", occurrence_date: "2026-01-01" }, "This task is an occurrence of a recurring task"],
		[{ status: "open" }, "Current task is not completed"],
	])("rejects ineligible tasks without confirming or writing: %j", async (task, notice) => {
		const plugin = createPlugin(task);
		await plugin.repeatCurrentTask();
		expect(Notice).toHaveBeenCalledWith(notice);
		expect(confirm).not.toHaveBeenCalled();
		expect(plugin.taskService.repeatTask).not.toHaveBeenCalled();
	});

	it("explains retained earlier changes on failure and skips the editor", async () => {
		const plugin = createPlugin();
		jest.mocked(plugin.taskService.repeatTask).mockRejectedValue(new Error("write denied"));
		await plugin.repeatCurrentTask();
		expect(Notice).toHaveBeenCalledWith("Could not finish repeating task. Earlier changes were kept; check the task before trying again.");
		expect(plugin.openTaskEditModal).not.toHaveBeenCalled();
	});
});
