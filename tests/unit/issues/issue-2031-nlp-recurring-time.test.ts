import type TaskNotesPlugin from "../../../src/main";
import { addDTSTARTToRecurrenceRule } from "../../../src/core/recurrence";
import { buildTaskCreationDataFromParsed } from "../../../src/services/buildTaskCreationDataFromParsed";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import type { ParsedTaskData } from "../../../src/services/NaturalLanguageParser";

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {
			...DEFAULT_SETTINGS,
		},
	} as unknown as TaskNotesPlugin;
}

describe("Issue #2031: NLP recurring task with time", () => {
	it("adds DTSTART for NLP-created recurring tasks with minute-precision scheduled times", () => {
		const parsed: ParsedTaskData = {
			title: "this is a task",
			scheduledDate: "2026-06-13",
			scheduledTime: "15:00",
			recurrence: "FREQ=DAILY",
		};

		const taskData = buildTaskCreationDataFromParsed(createPlugin(), parsed);

		expect(taskData.scheduled).toBe("2026-06-13T15:00");
		expect(taskData.recurrence).toBe("FREQ=DAILY");
		expect(
			addDTSTARTToRecurrenceRule({
				title: taskData.title,
				status: taskData.status,
				priority: taskData.priority,
				path: "",
				archived: false,
				scheduled: taskData.scheduled,
				recurrence: taskData.recurrence,
			})
		).toBe("DTSTART:20260613T150000Z;FREQ=DAILY");
	});
});
