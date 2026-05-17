import { identifyTaskNotesFromBasesData, type BasesDataItem } from "../../../src/bases/helpers";
import type TaskNotesPlugin from "../../../src/main";

function createPlugin(): TaskNotesPlugin {
	const plugin = {
		settings: {
			taskIdentificationMethod: "tag",
			taskTag: "task",
			defaultTaskStatus: "open",
			storeTitleInFilename: true,
		},
		app: {
			metadataCache: {
				getCache: jest.fn((path: string) => {
					if (path === "metadata-cached-task.md") {
						return { frontmatter: { tags: ["task"] } };
					}
					return null;
				}),
			},
		},
		cacheManager: {
			isTaskFile: jest.fn((frontmatter: unknown) => {
				if (!frontmatter || typeof frontmatter !== "object") {
					return false;
				}

				const tags = (frontmatter as { tags?: unknown }).tags;
				return Array.isArray(tags) && tags.includes("task");
			}),
			getCachedTaskInfoSync: jest.fn((path: string) => {
				if (path === "sync-cached-task.md") {
					return {
						title: "Cached task",
						status: "open",
						priority: "normal",
						path,
						archived: false,
					};
				}
				return null;
			}),
		},
		fieldMapper: {
			mapFromFrontmatter: jest.fn((props: Record<string, unknown>) => props),
		},
	} as unknown as TaskNotesPlugin;

	return plugin;
}

describe("issue #1270 Bases task filtering", () => {
	it("excludes regular notes and attachments from TaskNotes Bases layouts", async () => {
		const dataItems: BasesDataItem[] = [
			{
				path: "tasks/real-task.md",
				name: "real-task",
				properties: { title: "Real task", tags: ["task"], status: "open" },
			},
			{
				path: "notes/meeting.md",
				name: "meeting",
				properties: { title: "Meeting notes", tags: ["meeting"] },
			},
			{
				path: "attachments/screenshot.png",
				name: "screenshot",
				properties: {},
			},
			{
				path: "metadata-cached-task.md",
				name: "metadata-cached-task",
				properties: {},
			},
			{
				path: "sync-cached-task.md",
				name: "sync-cached-task",
				properties: {},
			},
		];

		const tasks = await identifyTaskNotesFromBasesData(dataItems, createPlugin());

		expect(tasks.map((task) => task.path)).toEqual([
			"tasks/real-task.md",
			"metadata-cached-task.md",
			"sync-cached-task.md",
		]);
	});

	it("keeps legacy conversion behavior when no plugin context is available", async () => {
		const dataItems: BasesDataItem[] = [
			{ path: "notes/meeting.md", name: "meeting", properties: {} },
			{ path: "attachments/screenshot.png", name: "screenshot", properties: {} },
		];

		const tasks = await identifyTaskNotesFromBasesData(dataItems);

		expect(tasks.map((task) => task.path)).toEqual([
			"notes/meeting.md",
			"attachments/screenshot.png",
		]);
	});
});
