import { TFile } from "obsidian";
import { serialize, deserialize } from "node:v8";
import { KanbanView } from "../../../src/bases/KanbanView";
import { buildTaskMovementUndo, type TaskMovementUndoChange } from "../../../src/bases/taskMovementUndo";

const mockProcessVaultFrontMatter = jest.fn();
jest.mock("../../../src/services/VaultMutationService", () => ({
	processVaultFrontMatter: (...args: unknown[]) => mockProcessVaultFrontMatter(...args),
}));

function receiptHarness(before: Record<string, unknown>, after: Record<string, unknown>) {
	const file = new TFile("tasks/drop.md");
	const frontmatter = structuredClone(after);
	const mapping: Record<string, string> = { status: "status", priority: "priority", sort_order: "sortOrder" };
	const cache = jest.fn();
	const sideEffects = jest.fn();
	const view = Object.create(KanbanView.prototype) as {
		createDropUndo(file: TFile, changes: readonly TaskMovementUndoChange[]): () => Promise<void>;
	};
	Object.assign(view, {
		plugin: {
			app: { vault: { getAbstractFileByPath: () => file } },
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
	});
	mockProcessVaultFrontMatter.mockImplementation(async (_app, _file, update) => update(frontmatter));
	return { frontmatter, cache, sideEffects, undo: view.createDropUndo(file, buildTaskMovementUndo(before, after, "modified")) };
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
	await expect(harness.undo()).rejects.toThrow("Task changed since drop");
	expect(harness.frontmatter).toEqual({ status: "waiting", sort_order: "tnzzzzz" });
	expect(harness.cache).not.toHaveBeenCalled();
	expect(harness.sideEffects).not.toHaveBeenCalled();
});

it("removes a previously absent custom swimlane from the note and immediate cache", async () => {
	const harness = receiptHarness({ status: "open" }, { status: "waiting", customLane: "team" });
	await harness.undo();
	expect(harness.frontmatter).not.toHaveProperty("customLane");
	expect(harness.cache).toHaveBeenCalledWith("tasks/drop.md", expect.objectContaining({ customLane: undefined, customProperties: {} }));
	expect(harness.sideEffects).toHaveBeenCalledTimes(2);
});
