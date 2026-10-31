import { serialize, deserialize } from "node:v8";
import { TFile } from "obsidian";
import { TaskService } from "../../../src/services/TaskService";
import { completeRecurringTaskWithUndo } from "../../../src/services/task-service/recurringCompletionUndo";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";
import type { TaskInfo } from "../../../src/types";

globalThis.structuredClone ??= (value) => deserialize(serialize(value));

const occurrence = "2024-01-12";
const targetDate = new Date(`${occurrence}T12:00:00.000Z`);

function createService(stored: TaskInfo) {
	const processFrontMatter = jest.fn((_file: unknown, fn: (fm: Record<string, unknown>) => void) => {
		fn({ ...stored });
		return Promise.resolve();
	});
	const service = new TaskService(
		PluginFactory.createMockPlugin({
			app: {
				vault: { getAbstractFileByPath: () => new TFile(stored.path), modify: jest.fn() },
				workspace: { getActiveFile: jest.fn() },
				metadataCache: { getCache: jest.fn() },
				fileManager: { processFrontMatter },
			},
			fieldMapper: { toUserField: (field: string) => field },
			cacheManager: {
				getTaskInfo: jest.fn().mockResolvedValue(stored),
				updateTaskInfoInCache: jest.fn(),
			},
		})
	);
	return { service, processFrontMatter };
}

const series = (overrides: Partial<TaskInfo> = {}) =>
	TaskFactory.createTask({
		path: "tasks/weekly.md",
		status: "open",
		recurrence: "DTSTART:20240112;FREQ=WEEKLY",
		scheduled: occurrence,
		complete_instances: [],
		...overrides,
	});

const stillOpen = (task: TaskInfo) =>
	task.scheduled === occurrence &&
	!task.complete_instances?.includes(occurrence) &&
	!task.skipped_instances?.includes(occurrence);

describe("guarded recurring completion", () => {
	it.each([
		["completed", { scheduled: "2024-01-19", complete_instances: [occurrence] }],
		["skipped", { scheduled: "2024-01-19", skipped_instances: [occurrence] }],
		["rescheduled", { scheduled: "2024-01-14", recurrence_original_date: occurrence }],
	])("writes nothing when the occurrence was %s after the caller's check", async (_change, change) => {
		const stored = series(change);
		const { service, processFrontMatter } = createService(stored);

		const result = await service.toggleRecurringTaskComplete(series(), targetDate, {
			onlyIf: stillOpen,
		});

		expect(processFrontMatter).not.toHaveBeenCalled();
		expect(result).toBe(stored);
	});

	it("never reopens a completed occurrence, whatever the condition says", async () => {
		const stored = series({ complete_instances: [occurrence] });
		const { service, processFrontMatter } = createService(stored);

		await service.toggleRecurringTaskComplete(series(), targetDate, { onlyIf: () => true });

		expect(processFrontMatter).not.toHaveBeenCalled();
	});

	it("completes an occurrence that is still open", async () => {
		const stored = series();
		const { service, processFrontMatter } = createService(stored);

		const result = await service.toggleRecurringTaskComplete(stored, targetDate, {
			onlyIf: stillOpen,
		});

		expect(processFrontMatter).toHaveBeenCalledTimes(1);
		expect(result.complete_instances).toEqual([occurrence]);
	});

	it("still toggles a completed occurrence off for callers without a condition", async () => {
		const stored = series({ complete_instances: [occurrence] });
		const { service } = createService(stored);

		const result = await service.toggleRecurringTaskComplete(stored, targetDate);

		expect(result.complete_instances).toEqual([]);
	});

	describe("the completion receipt", () => {
		const file = new TFile("tasks/weekly.md");
		const content = "---\nscheduled: 2024-01-12\n---\n";
		const pluginReading = (...contents: string[]) => {
			const toggle = jest.fn(async (task: TaskInfo) => task);
			const read = jest.fn();
			contents.forEach((text) => read.mockResolvedValueOnce(text));
			return {
				toggle,
				plugin: {
					app: { vault: { getAbstractFileByPath: () => file, read } },
					cacheManager: { getTaskInfo: jest.fn().mockResolvedValue(series()) },
					fieldMapper: {
						toUserField: (field: string) => field,
						mapFromFrontmatter: () => series(),
					},
					settings: { resetCheckboxesOnRecurrence: false },
					statusManager: { isCompletedStatus: () => false },
					taskService: {
						findMaterializedOccurrence: jest.fn().mockResolvedValue(null),
						toggleRecurringTaskCompleteWithOccurrenceNotes: toggle,
					},
				} as any,
			};
		};

		it("reports no change when the condition left the file alone", async () => {
			const { plugin, toggle } = pluginReading(content, content);

			const onlyIf = () => true;

			const result = await completeRecurringTaskWithUndo(plugin, series(), targetDate, {
				onlyIf,
			});

			expect(result.changed).toBe(false);
			expect(toggle).toHaveBeenCalledWith(expect.anything(), targetDate, expect.anything(), {
				onlyIf,
			});
		});

		it("reports a change when the file was written", async () => {
			const { plugin } = pluginReading(content, content.replace("01-12", "01-19"));

			const result = await completeRecurringTaskWithUndo(plugin, series(), targetDate);

			expect(result.changed).toBe(true);
		});

		it("creates no occurrence note for a stale completion", async () => {
			const { plugin } = pluginReading(content, content);
			const stored = series({ occurrence_materialization: "on_completion" });
			plugin.cacheManager.getTaskInfo.mockResolvedValue(stored);
			plugin.taskService.materializeOccurrence = jest.fn();

			await completeRecurringTaskWithUndo(plugin, stored, targetDate, { onlyIf: () => false });

			expect(plugin.taskService.materializeOccurrence).not.toHaveBeenCalled();
		});
	});

	describe("with an occurrence note", () => {
		const note = (status: string) =>
			TaskFactory.createTask({ path: "tasks/weekly-note.md", status, occurrence_date: occurrence });

		function withNote(status: string) {
			const { service } = createService(series());
			const toggleStatus = jest.fn();
			Object.assign(service, {
				findMaterializedOccurrence: jest.fn().mockResolvedValue(note(status)),
				toggleStatus,
			});
			return { service, toggleStatus };
		}

		it("leaves a completed note alone", async () => {
			const { service, toggleStatus } = withNote("done");

			await service.toggleRecurringTaskCompleteWithOccurrenceNotes(
				series(),
				targetDate,
				undefined,
				{ onlyIf: stillOpen }
			);

			expect(toggleStatus).not.toHaveBeenCalled();
		});

		it("leaves an open note alone when the condition no longer holds", async () => {
			const { service, toggleStatus } = withNote("open");

			await service.toggleRecurringTaskCompleteWithOccurrenceNotes(
				series(),
				targetDate,
				undefined,
				{ onlyIf: () => false }
			);

			expect(toggleStatus).not.toHaveBeenCalled();
		});

		it("completes a note that is still open", async () => {
			const { service, toggleStatus } = withNote("open");

			await service.toggleRecurringTaskCompleteWithOccurrenceNotes(
				series(),
				targetDate,
				undefined,
				{ onlyIf: stillOpen }
			);

			expect(toggleStatus).toHaveBeenCalledTimes(1);
		});
	});
});
