import { TFile } from "obsidian";
import { serialize, deserialize } from "node:v8";
import { createFileUndo } from "../../../src/ui/taskMutationUndo";
import { processVaultFile } from "../../../src/services/VaultMutationService";
import { buildTaskMovementUndo } from "../../../src/bases/taskMovementUndo";
import { readCompletionContent } from "../../../src/services/task-service/recurringCompletionUndo";

beforeAll(() => {
	globalThis.structuredClone = value => deserialize(serialize(value));
});

it("publishes restored cache and side effects before a queued edit can write", async () => {
	const file = new TFile("Tasks/Alpha.md");
	let content = "---\nscheduled: 2026-11-06T13:00\n---\nBody\n";
	let cached = { path: file.path, scheduled: "2026-11-06T13:00" };
	let nextEdit: Promise<unknown> | undefined;
	const app = { vault: {
		getAbstractFileByPath: () => file,
		read: async () => content,
		process: async (_file: TFile, update: (text: string) => string) => {
			content = update(content);
			return content;
		},
	} };
	const plugin = {
		app,
		settings: {},
		fieldMapper: {
			toUserField: () => "dateModified",
			lookupMappingKey: (property: string) => property,
			mapFromFrontmatter: (frontmatter: Record<string, unknown>) => frontmatter,
		},
		cacheManager: {
			getTaskInfo: async () => cached,
			updateTaskInfoInCache: (_path: string, task: typeof cached) => { cached = task; },
		},
		emitter: { trigger: jest.fn() },
		taskService: { applyPropertyChangeSideEffects: async (_file: TFile, _current: unknown, restored: typeof cached) => {
			nextEdit = processVaultFile(app, file, text => text.replace("T09:00", "T10:00")).then(() => {
				cached = { path: file.path, scheduled: "2026-11-06T10:00" };
			});
			await Promise.resolve();
			await Promise.resolve();
			cached = restored;
		} },
	};
	const changes = buildTaskMovementUndo({ scheduled: "2026-11-06T09:00" }, { scheduled: "2026-11-06T13:00" }, "dateModified");
	const reconcile = jest.fn(async () => {
		await nextEdit;
		expect(cached.scheduled).toBe("2026-11-06T10:00");
	});
	await createFileUndo(plugin as never, [{ file, content: { changes, beforeBody: "", afterBody: "" } }], reconcile)();
	expect(reconcile).toHaveBeenCalledTimes(1);
	await nextEdit;
	expect(readCompletionContent(content).frontmatter.scheduled).toBe("2026-11-06T10:00");
	expect(cached.scheduled).toBe("2026-11-06T10:00");
});

it("keeps Undo pending through reconciliation and allows reconciliation retry", async () => {
	let release: () => void = () => undefined;
	const pending = new Promise<void>(resolve => { release = resolve; });
	const reconcile = jest.fn().mockImplementationOnce(() => pending).mockResolvedValue(undefined);
	const undo = createFileUndo({ fieldMapper: { toUserField: (field: string) => field }, emitter: { trigger: jest.fn() } } as never, [], reconcile);
	let completed = false;
	const running = undo().then(() => { completed = true; });
	await Promise.resolve();
	expect(completed).toBe(false);
	release();
	await running;
	expect(completed).toBe(true);
	await undo();
	expect(reconcile).toHaveBeenCalledTimes(2);
});
