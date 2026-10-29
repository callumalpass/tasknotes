import { TFile } from "obsidian";
import { InstantTaskConvertService } from "../../../src/services/InstantTaskConvertService";
import { PluginFactory } from "../../helpers/mock-factories";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";

describe("instant conversion default projects (#2436)", () => {
	let plugin: any;
	let service: any;

	beforeEach(() => {
		plugin = PluginFactory.createMockPlugin({
			settings: {
				...DEFAULT_SETTINGS,
				useDefaultsOnInstantConvert: true,
				taskCreationDefaults: {
					...DEFAULT_SETTINGS.taskCreationDefaults,
					defaultDueDate: "none",
					defaultScheduledDate: "none",
					defaultProjects: "[[Homework]], [[School, Admin]]",
					defaultProjectsOnlyWhenEmpty: true,
				},
			},
		});
		plugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(null);
		plugin.taskService = {
			createTask: jest.fn().mockResolvedValue({ file: { path: "task.md" }, taskInfo: {} }),
		};
		service = new InstantTaskConvertService(plugin, plugin.statusManager, plugin.priorityManager);
	});

	async function projects(projects?: string[]) {
		await service.createTaskFile({ title: "Test", projects }, "");
		return plugin.taskService.createTask.mock.calls[0][0].projects;
	}

	it("uses defaults when the input has no project", async () => {
		expect(await projects()).toEqual(["[[Homework]]", "[[School, Admin]]"]);
	});

	it("replaces defaults with all parsed projects", async () => {
		expect(await projects(["[[Personal]]", "[[Errands]]"])).toEqual(["[[Personal]]", "[[Errands]]"]);
	});

	it("keeps additive behavior when the setting is off", async () => {
		plugin.settings.taskCreationDefaults.defaultProjectsOnlyWhenEmpty = false;
		expect(await projects(["[[Personal]]"])).toEqual(["[[Homework]]", "[[School, Admin]]", "[[Personal]]"]);
	});

	it("does not apply defaults when conversion defaults are off", async () => {
		plugin.settings.useDefaultsOnInstantConvert = false;
		expect(await projects(["[[Personal]]"])).toEqual(["[[Personal]]"]);
	});

	it("preserves the parent note when a parsed project replaces defaults", async () => {
		const file = new TFile();
		Object.assign(file, { path: "Parent.md", basename: "Parent" });
		plugin.app.workspace.getActiveFile.mockReturnValue(file);
		plugin.app.fileManager.generateMarkdownLink = jest.fn().mockReturnValue("[[Parent]]");
		plugin.settings.taskCreationDefaults.useParentNoteAsProject = true;
		expect(await projects(["[[Personal]]"])).toEqual(["[[Parent]]", "[[Personal]]"]);
	});
});
