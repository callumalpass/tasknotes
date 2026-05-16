import type { App } from "obsidian";
import { App as MockApp, MockObsidian } from "../../__mocks__/obsidian";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import type { TaskInfo } from "../../../src/types";
import { TaskManager } from "../../../src/utils/TaskManager";

const createMockApp = (): App => new MockApp() as unknown as App;

const createTask = (overrides: Partial<TaskInfo>): TaskInfo =>
	({
		id: "TaskNotes/Tasks/api-created.md",
		title: "API-created task",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Tasks/api-created.md",
		archived: false,
		tags: ["task"],
		contexts: [],
		projects: [],
		...overrides,
	}) as TaskInfo;

describe("Issue #1820: API-created task cache fallback", () => {
	let app: App;
	let manager: TaskManager;

	beforeEach(() => {
		MockObsidian.reset();
		app = createMockApp();
		manager = new TaskManager(
			app,
			{
				...DEFAULT_SETTINGS,
				taskIdentificationMethod: "tag",
				taskTag: "task",
				excludedFolders: "",
				storeTitleInFilename: false,
			},
			new FieldMapper(DEFAULT_FIELD_MAPPING)
		);
	});

	it("returns a just-written task while Obsidian metadata has not indexed frontmatter yet", async () => {
		const path = "TaskNotes/Tasks/api-created.md";
		MockObsidian.createTestFile(path, "---\ntitle: API-created task\ntags:\n  - task\n---\n");
		app.metadataCache.deleteCache(path);

		manager.updateTaskInfoInCache(path, createTask({ path }));

		await expect(manager.getTaskInfo(path)).resolves.toMatchObject({
			path,
			title: "API-created task",
		});

		const allTasks = await manager.getAllTasks();
		expect(allTasks.map((task) => task.path)).toContain(path);
	});

	it("drops the fallback once native metadata is available", async () => {
		const path = "TaskNotes/Tasks/api-created.md";
		MockObsidian.createTestFile(path, "---\ntitle: API-created task\ntags:\n  - task\n---\n");
		app.metadataCache.deleteCache(path);

		manager.updateTaskInfoInCache(path, createTask({ path, title: "Fallback title" }));
		app.metadataCache.setCache(path, {
			frontmatter: {
				title: "Metadata title",
				status: "open",
				priority: "normal",
				tags: ["task"],
			},
		});

		await expect(manager.getTaskInfo(path)).resolves.toMatchObject({
			path,
			title: "Metadata title",
		});
	});
});
