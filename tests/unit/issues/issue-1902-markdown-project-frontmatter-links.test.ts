import { TFile } from "obsidian";
import { ProjectSubtasksService } from "../../../src/services/ProjectSubtasksService";

function createFile(path: string): TFile {
	return new TFile(path);
}

describe("Issue #1902: markdown project links in frontmatter", () => {
	it("finds subtasks when frontmatter markdown links are absent from resolvedLinks", async () => {
		const taskFile = createFile("Tasks/filament-order.md");
		const projectFile = createFile("projects/3D Printing.md");
		const taskInfo = {
			path: taskFile.path,
			title: "Order filament",
			status: "open",
			priority: "normal",
			archived: false,
			projects: ["[3D Printing](../projects/3D%20Printing.md)"],
		};
		const taskFrontmatter = {
			tags: ["task"],
			projects: ["[3D Printing](../projects/3D%20Printing.md)"],
		};

		const plugin = {
			app: {
				vault: {
					getMarkdownFiles: jest.fn(() => [taskFile, projectFile]),
					getAbstractFileByPath: jest.fn((path: string) => {
						if (path === taskFile.path) return taskFile;
						if (path === projectFile.path) return projectFile;
						return null;
					}),
				},
				metadataCache: {
					resolvedLinks: {},
					unresolvedLinks: {},
					getCache: jest.fn((path: string) =>
						path === taskFile.path ? { frontmatter: taskFrontmatter } : null
					),
					getFileCache: jest.fn((file: TFile) =>
						file.path === taskFile.path ? { frontmatter: taskFrontmatter } : null
					),
					getFirstLinkpathDest: jest.fn((linkpath: string) =>
						linkpath.includes("3D Printing.md") ? projectFile : null
					),
				},
			},
			cacheManager: {
				isTaskFile: jest.fn((frontmatter: Record<string, unknown>) =>
					Array.isArray(frontmatter.tags) && frontmatter.tags.includes("task")
				),
				getTaskInfo: jest.fn(async (path: string) => (path === taskFile.path ? taskInfo : null)),
			},
			fieldMapper: {
				toUserField: jest.fn((field: string) => field),
			},
			statusManager: {
				isCompletedStatus: jest.fn(() => false),
			},
			priorityManager: {
				getPriorityWeight: jest.fn(() => 0),
			},
		};

		const service = new ProjectSubtasksService(plugin as never);

		await expect(service.getTasksLinkedToProject(projectFile)).resolves.toEqual([taskInfo]);
		expect(service.isTaskUsedAsProjectSync(projectFile.path)).toBe(true);
	});
});
