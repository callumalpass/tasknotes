import { serialize, deserialize } from "node:v8";
import { TFile } from "obsidian";
import {
	assignTaskParent,
	classifyTaskParentAssignment,
	resolveTaskParentPaths,
} from "../../../src/services/taskParentAssignment";
import { applyTaskMovementUndo } from "../../../src/bases/taskMovementUndo";

jest.mock("obsidian", () => ({
	...jest.requireActual("obsidian"),
	getFrontMatterInfo: (content: string) => ({ exists: true, frontmatter: content }),
	parseYaml: (content: string) => JSON.parse(content),
}));
jest.mock("../../../src/services/VaultMutationService", () => ({
	processVaultFrontMatter: async (
		app: any,
		file: TFile,
		update: (fm: Record<string, unknown>) => void
	) => app.fileManager.processFrontMatter(file, update),
}));
jest.mock("../../../src/utils/linkUtils", () => ({
	...jest.requireActual("../../../src/utils/linkUtils"),
	generateLink: (_app: unknown, parent: TFile) => `[[${parent.path}]]`,
}));

const classify = (source: string, target: string, graph: Record<string, string[]>) =>
	classifyTaskParentAssignment(source, target, graph[source] ?? [], (path) => graph[path] ?? []);

function fixture() {
	const contents = new Map<string, Record<string, unknown>>([
		[
			"Source.md",
			{
				tags: ["task"],
				status: "open",
				priority: "high",
				tasknotes_manual_order: "rank",
				projects: ["Unrelated", "[[Existing.md]]"],
			},
		],
		["Parent.md", { tags: ["task"], status: "done", priority: "low" }],
		["Middle.md", { tags: ["task"] }],
	]);
	const files = new Map(
		[...contents.keys()].map((path) => {
			const file = new TFile();
			file.path = path;
			file.basename = path.replace(/\.md$/, "");
			return [path, file] as const;
		})
	);
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) => files.get(path),
			read: jest.fn(async (file: TFile) => JSON.stringify(contents.get(file.path))),
		},
		metadataCache: {
			getFirstLinkpathDest: (link: string) =>
				files.get(link.endsWith(".md") ? link : `${link}.md`),
		},
		fileManager: {
			processFrontMatter: jest.fn(async (file: TFile, update: (fm: any) => void) => {
				const next = structuredClone(contents.get(file.path)!);
				update(next);
				contents.set(file.path, next);
			}),
		},
	};
	const plugin: any = {
		app,
		fieldMapper: { toUserField: (key: string) => key },
		settings: {},
		cacheManager: {
			isTaskFile: (fm: any) => fm.tags?.includes("task"),
			getTaskInfo: async (path: string) => ({ path, title: path, ...contents.get(path) }),
		},
		taskService: { applyPropertyChangeSideEffects: jest.fn(async () => undefined) },
	};
	return { plugin, app, files, contents };
}

beforeAll(() => {
	globalThis.structuredClone = (value) => deserialize(serialize(value));
});

describe("parent assignment planning", () => {
	it("resolves aliases, relative Markdown links and autolinks, not plain project labels", () => {
		const resolve = jest.fn((link: string) =>
			link === "Parent.md" ? "folder/Parent.md" : null
		);
		expect(
			resolveTaskParentPaths(
				[
					"[[Parent.md|Alias]]",
					"[Another](Parent.md)",
					"<Parent.md>",
					"Parent.md",
					"Missing",
					false,
				],
				"Source.md",
				resolve
			)
		).toEqual(["folder/Parent.md"]);
		expect(resolve).toHaveBeenCalledTimes(3);
	});
	it("supports a scalar project link", () =>
		expect(resolveTaskParentPaths("[[Parent]]", "Source", (link) => link)).toEqual(["Parent"]));
	it("rejects self assignment", () => expect(classify("A", "A", {})).toBe("self"));
	it("recognizes an existing membership", () =>
		expect(classify("A", "B", { A: ["B", "Other"] })).toBe("already"));
	it("rejects direct and indirect descendants", () => {
		expect(classify("A", "B", { B: ["A"] })).toBe("cycle");
		expect(classify("A", "B", { B: ["C", "Other"], C: ["A"] })).toBe("cycle");
	});
	it("terminates on unrelated pre-existing cycles and allows a valid addition", () =>
		expect(classify("A", "B", { B: ["C"], C: ["B"] })).toBe("assign"));
});

describe("fresh, serialized parent assignment", () => {
	it("appends one canonical parent without changing status, priority, rank or other projects", async () => {
		const { plugin, contents } = fixture();
		const before = structuredClone(contents.get("Source.md")!);
		const result = await assignTaskParent(plugin, "Source.md", "Parent.md");
		expect(contents.get("Source.md")).toMatchObject({
			...before,
			projects: [...(before.projects as string[]), "[[Parent.md]]"],
		});
		expect(result.undoChanges.map((change) => change.property)).toEqual(["projects"]);
		expect(plugin.taskService.applyPropertyChangeSideEffects).toHaveBeenCalledWith(
			expect.anything(),
			result.originalTask,
			result.updatedTask,
			"projects",
			before.projects,
			result.updatedTask.projects
		);
		const current = contents.get("Source.md")!;
		current.title = "Later edit";
		expect(applyTaskMovementUndo(current, result.undoChanges)).toBe(true);
		expect(current).toMatchObject({ ...before, title: "Later edit" });
	});
	it("restores absence of a projects property on Undo", async () => {
		const { plugin, contents } = fixture();
		delete contents.get("Source.md")!.projects;
		const result = await assignTaskParent(plugin, "Source.md", "Parent.md");
		expect(applyTaskMovementUndo(contents.get("Source.md")!, result.undoChanges)).toBe(true);
		expect(contents.get("Source.md")).not.toHaveProperty("projects");
	});
	it("uses custom project and modified-date mappings", async () => {
		const { plugin, contents } = fixture();
		plugin.fieldMapper.toUserField = (key: string) =>
			key === "projects" ? "owners" : key === "dateModified" ? "modified" : key;
		contents.get("Source.md")!.owners = ["Original"];
		delete contents.get("Source.md")!.projects;
		await assignTaskParent(plugin, "Source.md", "Parent.md");
		expect(contents.get("Source.md")).toMatchObject({
			owners: ["Original", "[[Parent.md]]"],
			modified: expect.any(String),
		});
		expect(contents.get("Source.md")).not.toHaveProperty("projects");
	});
	it("tolerates empty frontmatter in an unrelated project ancestor", async () => {
		const { plugin, contents, app } = fixture();
		contents.get("Parent.md")!.projects = ["[[Middle]]"];
		app.vault.read.mockImplementation(async (file) =>
			file.path === "Middle.md" ? "null" : JSON.stringify(contents.get(file.path))
		);
		await expect(assignTaskParent(plugin, "Source.md", "Parent.md")).resolves.toBeDefined();
	});

	it("preserves a legacy scalar project", async () => {
		const { plugin, contents } = fixture();
		contents.get("Source.md")!.projects = "Unrelated";
		await assignTaskParent(plugin, "Source.md", "Parent.md");
		expect(contents.get("Source.md")!.projects).toEqual(["Unrelated", "[[Parent.md]]"]);
	});
	it("does not duplicate an existing aliased parent", async () => {
		const { plugin, app, contents } = fixture();
		contents.get("Source.md")!.projects = ["[[Parent|Alias]]"];
		await expect(assignTaskParent(plugin, "Source.md", "Parent.md")).rejects.toMatchObject({
			reason: "already",
		});
		expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
	});
	it("validates ancestors from fresh files rather than a stale metadata preview", async () => {
		const { plugin, contents, app } = fixture();
		contents.get("Parent.md")!.projects = ["[[Middle]]"];
		contents.get("Middle.md")!.projects = ["[[Source]]"];
		await expect(assignTaskParent(plugin, "Source.md", "Parent.md")).rejects.toMatchObject({
			reason: "cycle",
		});
		expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
	});
	it("serializes opposite-direction drops to prevent a cycle", async () => {
		const { plugin } = fixture();
		const results = await Promise.allSettled([
			assignTaskParent(plugin, "Source.md", "Parent.md"),
			assignTaskParent(plugin, "Parent.md", "Source.md"),
		]);
		expect(results[0].status).toBe("fulfilled");
		expect(results[1]).toMatchObject({ status: "rejected", reason: { reason: "cycle" } });
	});
	it("rejects self assignment and missing/non-task parents without writing", async () => {
		const { plugin, app, contents } = fixture();
		await expect(assignTaskParent(plugin, "Source.md", "Source.md")).rejects.toMatchObject({
			reason: "self",
		});
		await expect(assignTaskParent(plugin, "Source.md", "Missing.md")).rejects.toMatchObject({
			reason: "unavailable",
		});
		contents.get("Parent.md")!.tags = [];
		await expect(assignTaskParent(plugin, "Source.md", "Parent.md")).rejects.toMatchObject({
			reason: "unavailable",
		});
		expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
	});
	it("guards a parent removed just before the write", async () => {
		const { plugin, app, files, contents } = fixture();
		const before = structuredClone(contents.get("Source.md")!);
		app.fileManager.processFrontMatter.mockImplementationOnce(async (file, update) => {
			files.delete("Parent.md");
			update(contents.get(file.path));
		});
		await expect(assignTaskParent(plugin, "Source.md", "Parent.md")).rejects.toMatchObject({
			reason: "unavailable",
		});
		expect(contents.get("Source.md")).toEqual(before);
	});
	it("preserves an unrelated membership added after validation", async () => {
		const { plugin, app, contents } = fixture();
		app.fileManager.processFrontMatter.mockImplementationOnce(async (file, update) => {
			const fm = contents.get(file.path)!;
			(fm.projects as string[]).push("Later");
			update(fm);
		});
		await assignTaskParent(plugin, "Source.md", "Parent.md");
		expect(contents.get("Source.md")!.projects).toEqual([
			"Unrelated",
			"[[Existing.md]]",
			"Later",
			"[[Parent.md]]",
		]);
	});
	it("leaves the file unchanged on persistence failure and lets the next operation run", async () => {
		const { plugin, app, contents } = fixture();
		const before = structuredClone(contents.get("Source.md")!);
		app.fileManager.processFrontMatter.mockRejectedValueOnce(new Error("Write failed"));
		await expect(assignTaskParent(plugin, "Source.md", "Parent.md")).rejects.toThrow(
			"Write failed"
		);
		expect(contents.get("Source.md")).toEqual(before);
		await expect(assignTaskParent(plugin, "Source.md", "Parent.md")).resolves.toBeDefined();
	});
});
