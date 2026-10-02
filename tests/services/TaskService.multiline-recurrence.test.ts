import { TFile } from "obsidian";
import { TaskService } from "../../src/services/TaskService";
import { TaskFactory } from "../helpers/mock-factories";

// TODO: enable after main consumes @tasknotes/model >= 0.3.0-rc.16.
// The rc.9/rc.15 model erases RRULE:FREQ across the DTSTART line break.
it.skip("completes a multiline completion-anchor task without losing FREQ", async () => {
	const task = TaskFactory.createTask({
		title: "Weekly task", path: "Tasks/weekly.md", status: "open",
		recurrence: "DTSTART:20260101T090000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
		recurrence_anchor: "completion", scheduled: "2026-01-05T09:00:00",
		complete_instances: [],
	});
	const frontmatter: Record<string, unknown> = { ...task };
	const plugin: any = {
		app: {
			vault: { getAbstractFileByPath: () => Object.assign(Object.create(TFile.prototype), { path: task.path }) },
			fileManager: { processFrontMatter: async (_file, change) => change(frontmatter) },
		},
		settings: { maintainDueDateOffsetInRecurring: false },
		fieldMapper: { toUserField: (key: string) => key },
		statusManager: { isCompletedStatus: (status: string) => status === "done", getCompletedStatuses: () => ["done"] },
		cacheManager: { getTaskInfo: async () => task, updateTaskInfoInCache: jest.fn() },
		emitter: { trigger: jest.fn() },
	};
	const service = new TaskService(plugin);
	const result = await service.toggleRecurringTaskComplete(task, new Date("2026-01-05T12:00:00Z"));
	expect(frontmatter.recurrence).toContain("\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
	expect(result.recurrence).toBe(frontmatter.recurrence);
});
