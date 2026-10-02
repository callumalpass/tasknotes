import { TFile } from "obsidian";
import { TaskUpdateService } from "../../src/services/task-service/TaskUpdateService";
import { FieldMapper } from "../../src/services/FieldMapper";
import { DEFAULT_SETTINGS } from "../../src/settings/defaults";

function fixture(collision = false) {
	const file = Object.assign(Object.create(TFile.prototype), {
		path: "Tasks/Original.md", basename: "Original", parent: { path: "Tasks" },
	});
	const frontmatter: Record<string, unknown> = { summary: "Original [[Wiki]]", tags: ["task"], custom: "keep" };
	const processFrontMatter = jest.fn(async (_file, change) => change(frontmatter));
	const renameFile = jest.fn(async (_file, path: string) => {
		file.path = path;
		file.basename = path.split("/").pop()!.slice(0, -3);
	});
	const mapper = new FieldMapper({ ...DEFAULT_SETTINGS.fieldMapping, title: "summary" });
	const runtime: any = {
		app: {
			vault: {
				getAbstractFileByPath: (path: string) => path === file.path ? file :
					collision && path === "Tasks/New title.md" ? {} : null,
				adapter: { exists: async () => false },
			},
			fileManager: { processFrontMatter, renameFile },
		},
		settings: { ...DEFAULT_SETTINGS, storeTitleInFilename: true },
		fieldMapper: mapper,
		cacheManager: { clearCacheEntry: jest.fn(), updateTaskInfoInCache: jest.fn() },
		expandedProjectsService: { renamePath: jest.fn() },
		projectSubtasksService: { invalidateIndex: jest.fn() },
		emitter: { trigger: jest.fn() },
		statusManager: { isCompletedStatus: () => false },
	};
	const service = new TaskUpdateService({ runtime, updateCompletedDateInFrontmatter: () => {} });
	const task = mapper.mapFromFrontmatter(frontmatter, file.path, true);
	return { service, task, file, frontmatter, mapper, renameFile, processFrontMatter };
}

describe("filename-backed title edits", () => {
	it.each(["Buy milk from [[Lidl]]", "Question: why?", "Long title ".repeat(40).trim()])(
		"retains the lossless mapped title for %s", async (title) => {
			const { service, task, file, frontmatter, mapper } = fixture();
			await service.updateTask(task, { title });
			expect(file.basename).not.toBe(title);
			expect(frontmatter.summary).toBe(title);
			expect(mapper.mapFromFrontmatter(frontmatter, file.path, true).title).toBe(title);
			expect(frontmatter.custom).toBe("keep");
		}
	);

	it("retains a title when a collision adds a suffix", async () => {
		const { service, task, file, frontmatter } = fixture(true);
		await service.updateTask(task, { title: "New title" });
		expect(file.basename).toBe("New title-2");
		expect(frontmatter.summary).toBe("New title");
	});

	it("removes a redundant title only after a successful exact rename", async () => {
		const { service, task, file, frontmatter, renameFile } = fixture();
		renameFile.mockImplementationOnce(async (_file, path) => {
			expect(frontmatter.summary).toBe("Original [[Wiki]]");
			file.path = path;
			file.basename = "New title";
		});
		await service.updateTask(task, { title: "New title" });
		expect(frontmatter).not.toHaveProperty("summary");
	});

	it("rejects a failed rename without changing the old title or other fields", async () => {
		const { service, task, file, frontmatter, renameFile, processFrontMatter } = fixture();
		const before = { ...frontmatter };
		renameFile.mockRejectedValueOnce(new Error("Permission denied"));
		await expect(service.updateTask(task, { title: "New title", priority: "high" })).rejects.toThrow("Permission denied");
		expect(file.path).toBe("Tasks/Original.md");
		expect(frontmatter).toEqual(before);
		expect(processFrontMatter).not.toHaveBeenCalled();
	});
});
