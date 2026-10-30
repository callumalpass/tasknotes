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

describe("completeOnly recurring completion", () => {
	it("writes nothing when the occurrence finished after the caller's check", async () => {
		const stored = series({ scheduled: "2024-01-19", complete_instances: [occurrence] });
		const { service, processFrontMatter } = createService(stored);

		const result = await service.toggleRecurringTaskComplete(series(), targetDate, {
			completeOnly: true,
		});

		expect(processFrontMatter).not.toHaveBeenCalled();
		expect(result).toBe(stored);
	});

	it("completes an occurrence that is still open", async () => {
		const stored = series();
		const { service, processFrontMatter } = createService(stored);

		const result = await service.toggleRecurringTaskComplete(stored, targetDate, {
			completeOnly: true,
		});

		expect(processFrontMatter).toHaveBeenCalledTimes(1);
		expect(result.complete_instances).toEqual([occurrence]);
	});

	it("still toggles a completed occurrence off for callers without the option", async () => {
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

		it("reports no change when completeOnly left the file alone", async () => {
			const { plugin, toggle } = pluginReading(content, content);

			const result = await completeRecurringTaskWithUndo(plugin, series(), targetDate, {
				completeOnly: true,
			});

			expect(result.changed).toBe(false);
			expect(toggle).toHaveBeenCalledWith(expect.anything(), targetDate, expect.anything(), {
				completeOnly: true,
			});
		});

		it("reports a change when the file was written", async () => {
			const { plugin } = pluginReading(content, content.replace("01-12", "01-19"));

			const result = await completeRecurringTaskWithUndo(plugin, series(), targetDate);

			expect(result.changed).toBe(true);
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
				{ completeOnly: true }
			);

			expect(toggleStatus).not.toHaveBeenCalled();
		});

		it("completes a note that is still open", async () => {
			const { service, toggleStatus } = withNote("open");

			await service.toggleRecurringTaskCompleteWithOccurrenceNotes(
				series(),
				targetDate,
				undefined,
				{ completeOnly: true }
			);

			expect(toggleStatus).toHaveBeenCalledTimes(1);
		});
	});
});
