import { App as MockApp, MockObsidian } from "../../__mocks__/obsidian";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { TaskService } from "../../../src/services/TaskService";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { generateTaskFilename } from "../../../src/utils/filenameGenerator";
import type { TaskNotesSettings } from "../../../src/types/settings";

const customFilenameSettings = (template: string): TaskNotesSettings =>
	({
		...DEFAULT_SETTINGS,
		storeTitleInFilename: false,
		taskFilenameFormat: "custom",
		customFilenameTemplate: template,
		taskCreationDefaults: {
			...DEFAULT_SETTINGS.taskCreationDefaults,
			defaultDueDate: "none",
			defaultScheduledDate: "none",
		},
	}) as TaskNotesSettings;

const createTaskService = (template: string): TaskService => {
	const app = new MockApp();
	const plugin = {
		app,
		settings: customFilenameSettings(template),
		fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
		cacheManager: {
			waitForFreshTaskData: jest.fn().mockResolvedValue(undefined),
			updateTaskInfoInCache: jest.fn(),
		},
		emitter: {
			trigger: jest.fn(),
		},
		i18n: {
			translate: jest.fn((key: string) => key),
		},
	} as any;

	return new TaskService(plugin);
};

describe("Issue #1664: project filename template variables", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("supports first-project and project-id variables in custom filename templates", () => {
		const filename = generateTaskFilename(
			{
				title: "Write Summary",
				priority: "normal",
				status: "open",
				date: new Date(2026, 1, 3, 4, 5, 6),
				projects: ["[[Projects/Task Platform|Task Platform]]"],
			},
			customFilenameSettings("{{year}}Q{{quarter}}{{projectId}}-{{project}}-{{titleSnake}}")
		);

		expect(filename).toBe("2026Q1TASK-Task Platform-write_summary");
	});

	it("uses wikilink basenames when project aliases are absent", () => {
		const filename = generateTaskFilename(
			{
				title: "Prepare Review",
				priority: "normal",
				status: "open",
				projects: ["[[Areas/Admin Tasks]]"],
			},
			customFilenameSettings("{{projectId}}-{{project}}")
		);

		expect(filename).toBe("ADMI-Admin Tasks");
	});

	it("falls back to the sanitized title when only missing project variables render", () => {
		const filename = generateTaskFilename(
			{
				title: "Fallback Title",
				priority: "normal",
				status: "open",
				projects: [],
			},
			customFilenameSettings("{{projectId}}{{project}}{{projects}}")
		);

		expect(filename).toBe("Fallback Title");
	});

	it("passes task projects through during normal task creation", async () => {
		const service = createTaskService("{{projectId}}-{{project}}-{{titleSnake}}");

		const result = await service.createTask(
			{
				title: "Write Summary",
				priority: "normal",
				status: "open",
				projects: ["[[Projects/Task Platform|Task Platform]]"],
			},
			{ applyDefaults: false }
		);

		expect(result.file.path).toBe("TaskNotes/Tasks/TASK-Task Platform-write_summary.md");
		expect(result.taskInfo.projects).toEqual(["[[Projects/Task Platform|Task Platform]]"]);
	});
});
