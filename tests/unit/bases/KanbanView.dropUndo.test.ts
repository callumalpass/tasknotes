import { TFile, stringifyYaml } from "obsidian";
import { serialize, deserialize } from "node:v8";
import { createFileUndo } from "../../../src/ui/taskMutationUndo";
import { readCompletionContent } from "../../../src/services/task-service/recurringCompletionUndo";
import { buildTaskMovementUndo } from "../../../src/bases/taskMovementUndo";

const mockProcessVaultFrontMatter = jest.fn();
jest.mock("../../../src/services/VaultMutationService", () => ({
	processVaultFrontMatter: (...args: unknown[]) => mockProcessVaultFrontMatter(...args),
	withVaultFileMutation: async (_file: unknown, operation: () => Promise<unknown>) => operation(),
	processVaultFileWithinMutation: (...args: unknown[]) => mockProcessVaultFrontMatter(...args),
}));

function receiptHarness(before: Record<string, unknown>, after: Record<string, unknown>) {
	const file = new TFile("tasks/drop.md");
	const frontmatter = structuredClone(after);
	const mapping: Record<string, string> = { status: "status", priority: "priority", sort_order: "sortOrder" };
	const cache = jest.fn();
	const sideEffects = jest.fn();
	const view = {
		plugin: {
			app: { vault: { getAbstractFileByPath: () => file, read: async () => `---\n${stringifyYaml(frontmatter)}---\nBody\n` } },
			emitter: { trigger: jest.fn() },
			settings: { userFields: [{ key: "customLane" }] },
			fieldMapper: {
				toUserField: () => "modified",
				lookupMappingKey: (field: string) => mapping[field],
				mapFromFrontmatter: (values: Record<string, unknown>) => ({
					...values,
					sortOrder: values.sort_order,
					customProperties: Object.hasOwn(values, "customLane") ? { customLane: values.customLane } : {},
				}),
			},
			cacheManager: {
				getTaskInfo: async () => ({ path: file.path, ...after }),
				updateTaskInfoInCache: cache,
			},
			taskService: { applyPropertyChangeSideEffects: sideEffects },
		},
		debouncedRefresh: jest.fn(),
	};
	mockProcessVaultFrontMatter.mockImplementation(async (_app, _file, update) => {
		const restored = readCompletionContent(update(`---\n${stringifyYaml(frontmatter)}---\nBody\n`));
		for (const key of Object.keys(frontmatter)) delete frontmatter[key];
		Object.assign(frontmatter, restored.frontmatter);
	});
	return { frontmatter, cache, sideEffects, undo: createFileUndo(view.plugin as never, [{ file, content: { changes: buildTaskMovementUndo(before, after, "modified"), beforeBody: "", afterBody: "" } }]) };
}

beforeAll(() => { globalThis.structuredClone = value => deserialize(serialize(value)); });
beforeEach(() => jest.clearAllMocks());

it("restores both axes and an owned rank while retaining unrelated edits", async () => {
	const before = { status: "open", priority: "high", sort_order: "tnaaaaa" };
	const harness = receiptHarness(before, { status: "waiting", priority: "low", sort_order: "tnzzzzz" });
	harness.frontmatter.unrelated = "keep";
	await harness.undo();
	expect(harness.frontmatter).toMatchObject({ ...before, unrelated: "keep" });
	expect(harness.cache).toHaveBeenCalledWith("tasks/drop.md", expect.objectContaining({ sortOrder: "tnaaaaa" }));
	expect(harness.sideEffects).toHaveBeenCalledTimes(3);
});

it("refuses the entire receipt when the rank changed after the drop", async () => {
	const harness = receiptHarness({ status: "open", sort_order: "tnaaaaa" }, { status: "waiting", sort_order: "tnmmmmm" });
	harness.frontmatter.sort_order = "tnzzzzz";
	await expect(harness.undo()).rejects.toThrow("Note changed:");
	expect(harness.frontmatter).toEqual({ status: "waiting", sort_order: "tnzzzzz" });
	expect(harness.cache).not.toHaveBeenCalled();
	expect(harness.sideEffects).not.toHaveBeenCalled();
});

it("retries refresh after a side-effect failure without replaying restored disk writes", async () => {
	const harness = receiptHarness({ status: "open" }, { status: "waiting" });
	harness.sideEffects.mockRejectedValueOnce(new Error("Refresh failed"));
	await expect(harness.undo()).rejects.toThrow("Refresh failed");
	expect(harness.frontmatter.status).toBe("open");
	const writes = mockProcessVaultFrontMatter.mock.calls.length;
	await harness.undo();
	expect(mockProcessVaultFrontMatter).toHaveBeenCalledTimes(writes);
	expect(harness.frontmatter.status).toBe("open");
});

it("removes a previously absent custom swimlane from the note and immediate cache", async () => {
	const harness = receiptHarness({ status: "open" }, { status: "waiting", customLane: "team" });
	await harness.undo();
	expect(harness.frontmatter).not.toHaveProperty("customLane");
	expect(harness.cache).toHaveBeenCalledWith("tasks/drop.md", expect.objectContaining({ customLane: undefined, customProperties: {} }));
	expect(harness.sideEffects).toHaveBeenCalledTimes(2);
});

function neighbors() {
	const files = [new TFile("tasks/a.md"), new TFile("tasks/b.md")];
	const content = new Map(files.map((file, index) => [file.path, `---\nstatus: open\nsort_order: new-${index}\n---\nKeep\n`]));
	const plugin = {
		app: { vault: { getAbstractFileByPath: (path: string) => files.find(file => file.path === path), read: async (file: TFile) => content.get(file.path) } },
		fieldMapper: { toUserField: () => "modified" },
		cacheManager: { getTaskInfo: async () => null },
		emitter: { trigger: jest.fn() },
	};
	const undo = createFileUndo(plugin as never, files.map((file, index) => ({ file, content: {
		changes: buildTaskMovementUndo({ status: "open" }, { status: "open", sort_order: `new-${index}` }, "modified"), beforeBody: "", afterBody: "",
	} })));
	mockProcessVaultFrontMatter.mockImplementation(async (_app, file: TFile, update) => content.set(file.path, update(content.get(file.path))));
	return { files, content, undo };
}

it("validates every rewritten neighbor before restoring any note", async () => {
	const { content, undo } = neighbors();
	content.set("tasks/b.md", content.get("tasks/b.md")!.replace("new-1", "outside"));
	const before = new Map(content);
	await expect(undo()).rejects.toThrow("Note changed:");
	expect(content).toEqual(before);
	expect(mockProcessVaultFrontMatter).not.toHaveBeenCalled();
});

it("rolls back already restored neighbors when a later disk write fails", async () => {
	const { content, undo } = neighbors();
	mockProcessVaultFrontMatter.mockImplementationOnce(async (_app, file: TFile, update) => content.set(file.path, update(content.get(file.path))))
		.mockImplementationOnce(async () => { throw new Error("Disk write failed"); });
	await expect(undo()).rejects.toThrow("Disk write failed");
	for (const [path, value] of content) expect(readCompletionContent(value).frontmatter.sort_order).toBe(path.endsWith("a.md") ? "new-0" : "new-1");
});
