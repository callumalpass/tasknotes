import { serialize, deserialize } from "node:v8";
import type { App } from "obsidian";
import { App as MockApp, MockObsidian } from "../../helpers/obsidian-runtime";
import { FieldMapper } from "../../../src/core/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { TaskManager } from "../../../src/utils/TaskManager";
import {
	completeRecurringTaskWithUndo,
	readCompletionContent,
} from "../../../src/services/task-service/recurringCompletionUndo";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

// Real FieldMapper + TaskManager defaults, rather than an identity mapper or a
// preassembled synthetic task. Completion writes are isolated from the recurrence
// engine so this specifically checks the receipt/runtime boundary.
describe("recurring Undo with runtime defaults and mappings", () => {
	beforeEach(() => {
		MockObsidian.reset();
		globalThis.structuredClone = (value) => deserialize(serialize(value));
	});

	it.each([
		["status", false],
		["workflow_state", false],
		["status", true],
		["workflow_state", true],
	])(
		"restores omitted %s (materialized=%s) without publishing an undefined status",
		async (statusProperty, materialized) => {
			const app = new MockApp() as unknown as App;
			const settings = {
				...DEFAULT_SETTINGS,
				defaultTaskStatus: "pending",
				taskIdentificationMethod: "tag" as const,
				taskTag: "task",
				excludedFolders: "",
				storeTitleInFilename: false,
				fieldMapping: { ...DEFAULT_FIELD_MAPPING, status: statusProperty },
			};
			const mapper = new FieldMapper(settings.fieldMapping);
			const manager = new TaskManager(app, settings, mapper);
			const parentPath = "Tasks/Annual.md";
			const occurrencePath = "Tasks/Annual occurrence.md";
			MockObsidian.createTestFile(
				parentPath,
				"---\ntitle: Annual\ntags: [task]\nscheduled: 2035-10-21\nrecurrence: DTSTART:20351021;FREQ=YEARLY\n---\n"
			);
			if (materialized)
				MockObsidian.createTestFile(
					occurrencePath,
					`---\ntitle: Annual occurrence\ntags: [task]\n${statusProperty}: pending\nrecurrence_parent: '[[Annual]]'\noccurrence_date: 2035-10-21\n---\n`
				);
			const parent = (await manager.getTaskInfo(parentPath))!;
			expect(parent.status).toBe("pending");
			const occurrence = materialized ? await manager.getTaskInfo(occurrencePath) : null;
			const trigger = jest.fn();
			const plugin = {
				app,
				settings,
				fieldMapper: mapper,
				cacheManager: manager,
				emitter: { trigger },
				statusManager: { isCompletedStatus: (status: string) => status === "done" },
				taskService: {
					findMaterializedOccurrence: async () => occurrence,
					toggleRecurringTaskCompleteWithOccurrenceNotes: async (
						_original: TaskInfo,
						_date: Date,
						onParentUpdated: (original: TaskInfo, updated: TaskInfo) => void
					) => {
						await app.vault.modify(
							app.vault.getAbstractFileByPath(parentPath) as any,
							"---\ntitle: Annual\ntags: [task]\nscheduled: 2036-10-21\nrecurrence: DTSTART:20351021;FREQ=YEARLY\ncomplete_instances: [2035-10-21]\n---\n"
						);
						const updatedParent = (await manager.getTaskInfo(parentPath))!;
						if (!occurrence) return updatedParent;
						onParentUpdated(parent, updatedParent);
						await app.vault.modify(
							app.vault.getAbstractFileByPath(occurrencePath) as any,
							`---\ntitle: Annual occurrence\ntags: [task]\n${statusProperty}: done\nrecurrence_parent: '[[Annual]]'\noccurrence_date: 2035-10-21\n---\n`
						);
						return (await manager.getTaskInfo(occurrencePath))!;
					},
				},
			} as unknown as TaskNotesPlugin;
			const completion = await completeRecurringTaskWithUndo(
				plugin,
				parent,
				new Date("2035-10-21T00:00:00Z")
			);
			expect(completion.updatedTask.path).toBe(parentPath);
			expect(completion.completed).toBe(true);
			expect(await completion.undo()).toBe(true);
			const restored = (await manager.getTaskInfo(parentPath))!;
			expect(restored.status).toBe("pending");
			expect(restored.scheduled).toBe("2035-10-21");
			expect(restored.complete_instances ?? []).toEqual([]);
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath(parentPath) as any
			);
			expect(readCompletionContent(content).frontmatter).not.toHaveProperty(statusProperty);
			expect(trigger).toHaveBeenCalledWith(
				"task-updated",
				expect.objectContaining({
					updatedTask: expect.objectContaining({ path: parentPath, status: "pending" }),
				})
			);
			if (materialized)
				expect((await manager.getTaskInfo(occurrencePath))!.status).toBe("pending");
		}
	);
});
