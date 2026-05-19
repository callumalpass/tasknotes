import type { App } from "obsidian";
import { App as MockApp, MockObsidian } from "../../__mocks__/obsidian";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { EVENT_TASK_UPDATED, type TaskInfo } from "../../../src/types";
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

	it("keeps just-written task data while native metadata is still stale", async () => {
		const path = "TaskNotes/Tasks/api-created.md";
		MockObsidian.createTestFile(
			path,
			"---\ntitle: API-created task\ntags:\n  - task\nscheduled: 2026-05-18\ndateModified: 2026-05-18T09:00:00.000Z\n---\n"
		);
		app.metadataCache.setCache(path, {
			frontmatter: {
				title: "API-created task",
				status: "open",
				priority: "normal",
				tags: ["task"],
				scheduled: "2026-05-18",
				dateModified: "2026-05-18T09:00:00.000Z",
			},
		});

		manager.updateTaskInfoInCache(
			path,
			createTask({
				path,
				scheduled: "2026-05-20",
				dateModified: "2026-05-18T09:05:00.000Z",
			})
		);

		await expect(manager.getTaskInfo(path)).resolves.toMatchObject({
			path,
			scheduled: "2026-05-20",
			dateModified: "2026-05-18T09:05:00.000Z",
		});
	});

	it("keeps just-written task data for synchronous cache reads while native metadata is stale", () => {
		const path = "TaskNotes/Tasks/api-created.md";
		MockObsidian.createTestFile(
			path,
			"---\ntitle: API-created task\ntags:\n  - task\nscheduled: 2026-05-18\ndateModified: 2026-05-18T09:00:00.000Z\n---\n"
		);
		app.metadataCache.setCache(path, {
			frontmatter: {
				title: "API-created task",
				status: "open",
				priority: "normal",
				tags: ["task"],
				scheduled: "2026-05-18",
				dateModified: "2026-05-18T09:00:00.000Z",
			},
		});

		manager.updateTaskInfoInCache(
			path,
			createTask({
				path,
				scheduled: "2026-05-20",
				dateModified: "2026-05-18T09:05:00.000Z",
			})
		);

		expect(manager.getCachedTaskInfoSync(path)).toMatchObject({
			path,
			scheduled: "2026-05-20",
			dateModified: "2026-05-18T09:05:00.000Z",
		});
	});

	it("does not drop just-written task data when a stale metadata change event arrives", async () => {
		jest.useFakeTimers();
		try {
			const path = "TaskNotes/Tasks/api-created.md";
			MockObsidian.createTestFile(
				path,
				"---\ntitle: API-created task\ntags:\n  - task\nscheduled: 2026-05-20T10:00\ndateModified: 2026-05-18T09:05:00.000Z\n---\n"
			);
			app.metadataCache.setCache(path, {
				frontmatter: {
					title: "API-created task",
					status: "open",
					priority: "normal",
					tags: ["task"],
					scheduled: "2026-05-18",
					dateModified: "2026-05-18T09:00:00.000Z",
				},
			});
			manager.initialize();
			const updates: TaskInfo[] = [];
			manager.on(EVENT_TASK_UPDATED, (payload: { updatedTask?: TaskInfo }) => {
				if (payload.updatedTask) {
					updates.push(payload.updatedTask);
				}
			});

			manager.updateTaskInfoInCache(
				path,
				createTask({
					path,
					scheduled: "2026-05-20T10:00",
					dateModified: "2026-05-18T09:05:00.000Z",
				})
			);

			app.metadataCache.setCache(path, {
				frontmatter: {
					title: "API-created task",
					status: "open",
					priority: "normal",
					tags: ["task"],
					scheduled: "2026-05-18",
					dateModified: "2026-05-18T09:00:00.000Z",
				},
			});
			jest.advanceTimersByTime(300);
			await Promise.resolve();

			await expect(manager.getTaskInfo(path)).resolves.toMatchObject({
				path,
				scheduled: "2026-05-20T10:00",
				dateModified: "2026-05-18T09:05:00.000Z",
			});
			expect(updates[updates.length - 1]).toMatchObject({
				path,
				scheduled: "2026-05-20T10:00",
			});
		} finally {
			jest.useRealTimers();
		}
	});
});
