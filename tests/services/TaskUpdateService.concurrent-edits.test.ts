import { TFile } from "obsidian";
import { TaskUpdateService } from "../../src/services/task-service/TaskUpdateService";

describe("concurrent task edits", () => {
	it("rebases a stale modal patch on current recurrence fields and returns that state", async () => {
		const file = Object.assign(Object.create(TFile.prototype), { path: "Tasks/example.md" });
		const fm: any = {
			status: "ready",
			priority: "normal",
			scheduled: "2026-09-07",
			recurrence: "DTSTART:20260905;FREQ=DAILY",
			complete_instances: ["2026-09-05", "2026-09-06"],
			timeEstimate: 5,
			custom: "keep",
		};
		const runtime: any = {
			app: {
				vault: { getAbstractFileByPath: () => file },
				fileManager: { processFrontMatter: async (_: unknown, fn: any) => fn(fm) },
			},
			settings: {
				storeTitleInFilename: false,
				maintainDueDateOffsetInRecurring: false,
				taskIdentificationMethod: "property",
				taskPropertyName: "type",
				taskPropertyValue: "task",
			},
			fieldMapper: {
				mapFromFrontmatter: (value: any) => ({ ...value }),
				mapToFrontmatter: (value: any) => ({ ...value }),
				toUserField: (key: string) => key,
			},
			cacheManager: { updateTaskInfoInCache: jest.fn() },
			emitter: { trigger: jest.fn() },
			statusManager: { isCompletedStatus: () => false },
		};
		const service = new TaskUpdateService({
			runtime,
			updateCompletedDateInFrontmatter: () => {},
		});
		const stale: any = {
			...fm,
			path: file.path,
			title: "Example",
			scheduled: "2026-09-06",
			due: "2026-09-01",
			complete_instances: ["2026-09-05"],
		};
		const result = await service.updateTask(stale, { timeEstimate: 10 });
		expect(fm.scheduled).toBe("2026-09-07");
		expect(fm.complete_instances).toEqual(["2026-09-05", "2026-09-06"]);
		expect(fm.custom).toBe("keep");
		expect(fm.due).toBeUndefined();
		expect(result.due).toBeUndefined();
		expect(result.scheduled).toBe("2026-09-07");
		expect(result.complete_instances).toEqual(fm.complete_instances);
		expect(result.timeEstimate).toBe(10);
		expect(stale.scheduled).toBe("2026-09-06");
	});
});
