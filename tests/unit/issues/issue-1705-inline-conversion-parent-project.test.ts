import { InstantTaskConvertService } from "../../../src/services/InstantTaskConvertService";
import { DEFAULT_TASK_CREATION_DEFAULTS } from "../../../src/settings/defaults";
import { PluginFactory } from "../../helpers/mock-factories";
import { TFile } from "../../helpers/obsidian-runtime";

describe("Issue #1705: inline conversion parent note project", () => {
	it("adds the current note as a project when instant-conversion defaults request it", async () => {
		let createdTaskData: any = null;
		const currentFile = new TFile("Projects/Home.md");
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				...PluginFactory.createMockPlugin().settings,
				useDefaultsOnInstantConvert: true,
				taskCreationDefaults: {
					...DEFAULT_TASK_CREATION_DEFAULTS,
					defaultProjects: "",
					useParentNoteForTaskCreation: false,
					useParentNoteAsProject: true,
					defaultContexts: "",
					defaultTags: "",
					defaultDueDate: "none",
					defaultScheduledDate: "none",
					defaultTimeEstimate: 0,
					defaultRecurrence: "none",
					defaultReminders: [],
				},
			},
		});

		plugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(currentFile);
		plugin.app.fileManager.generateMarkdownLink = jest
			.fn()
			.mockReturnValue("[[Projects/Home]]");
		plugin.taskService.createTask = jest.fn().mockImplementation(async (taskData) => {
			createdTaskData = taskData;
			return {
				file: new TFile("Tasks/Follow up.md"),
				taskInfo: { title: taskData.title },
			};
		});

		const service = new InstantTaskConvertService(
			plugin,
			plugin.statusManager,
			plugin.priorityManager
		);

		await (service as any).createTaskFile({ title: "Follow up", isCompleted: false });

		expect(createdTaskData.projects).toEqual(["[[Projects/Home]]"]);
		expect(createdTaskData.parentNote).toBe("[[Projects/Home]]");
		expect(createdTaskData.creationContext).toBe("inline-conversion");
	});

	it("does not use the normal task creation toggle for instant conversion", async () => {
		let createdTaskData: any = null;
		const currentFile = new TFile("Projects/Home.md");
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				...PluginFactory.createMockPlugin().settings,
				useDefaultsOnInstantConvert: true,
				taskCreationDefaults: {
					...DEFAULT_TASK_CREATION_DEFAULTS,
					useParentNoteForTaskCreation: true,
					useParentNoteAsProject: false,
				},
			},
		});

		plugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(currentFile);
		plugin.app.fileManager.generateMarkdownLink = jest
			.fn()
			.mockReturnValue("[[Projects/Home]]");
		plugin.taskService.createTask = jest.fn().mockImplementation(async (taskData) => {
			createdTaskData = taskData;
			return {
				file: new TFile("Tasks/Follow up.md"),
				taskInfo: { title: taskData.title },
			};
		});

		const service = new InstantTaskConvertService(
			plugin,
			plugin.statusManager,
			plugin.priorityManager
		);

		await (service as any).createTaskFile({ title: "Follow up", isCompleted: false });

		expect(createdTaskData.projects ?? []).toEqual([]);
		expect(createdTaskData.parentNote).toBe("[[Projects/Home]]");
		expect(createdTaskData.creationContext).toBe("inline-conversion");
	});
});
