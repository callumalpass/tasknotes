import { serialize, deserialize } from "node:v8";
import { TFile } from "obsidian";
import { completeRecurringTaskWithUndo } from "../../../src/services/task-service/recurringCompletionUndo";
import { cloneSnapshotData } from "../../../src/utils/cloneSnapshotData";
import { TaskFactory } from "../../helpers/mock-factories";
import type { TaskInfo } from "../../../src/types";

// Same semantics as the browser: functions and class instances are rejected.
globalThis.structuredClone ??= (value) => deserialize(serialize(value));

// Issue #2559: the reporter's note, a Bases task identified by `type: task`.
const before = `---
status: open
priority: normal
scheduled: 2026-11-12T08:30
dateCreated: 2026-10-05T08:10:37.821-04:00
dateModified: 2026-11-11T14:38:43.585-05:00
type: task
recurrence: DTSTART:20261005;FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
due: 2026-10-20T09:00
complete_instances:
  - 2026-11-09
  - 2026-11-11
skipped_instances: []
timeEstimate: 30
---
`;
const after = before
	.replace("scheduled: 2026-11-12T08:30", "scheduled: 2026-11-13T08:30")
	.replace("  - 2026-11-11\n", "  - 2026-11-11\n  - 2026-11-12\n");

class BasesEntry {
	app = { workspace: { trigger: () => undefined } };
	getValue = () => null;
}

const cardTask = (overrides: Partial<TaskInfo> = {}): TaskInfo =>
	TaskFactory.createTask({
		path: "Tasks/Standup.md",
		status: "open",
		scheduled: "2026-11-12T08:30",
		recurrence: "DTSTART:20261005;FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
		complete_instances: ["2026-11-09", "2026-11-11"],
		basesData: new BasesEntry(),
		...overrides,
	});

describe("issue #2559: completing a recurring task from a Bases view", () => {
	it("completes the occurrence when the task carries the Bases entry", async () => {
		const file = new TFile("Tasks/Standup.md");
		const completed = cardTask({
			scheduled: "2026-11-13T08:30",
			complete_instances: ["2026-11-09", "2026-11-11", "2026-11-12"],
		});
		const toggle = jest.fn(async () => completed);
		const read = jest.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
		const plugin = {
			app: { vault: { getAbstractFileByPath: () => file, read } },
			// The note is not identified as a task by TaskNotes' own settings, so
			// the cache has nothing and the card's TaskInfo is used as-is.
			cacheManager: { getTaskInfo: jest.fn().mockResolvedValue(null) },
			fieldMapper: {
				toUserField: (field: string) => field,
				mapFromFrontmatter: (frontmatter: Record<string, unknown>) => frontmatter,
			},
			settings: { resetCheckboxesOnRecurrence: false },
			statusManager: { isCompletedStatus: () => false },
			taskService: {
				findMaterializedOccurrence: jest.fn().mockResolvedValue(null),
				toggleRecurringTaskCompleteWithOccurrenceNotes: toggle,
			},
		} as any;

		const result = await completeRecurringTaskWithUndo(
			plugin,
			cardTask(),
			new Date("2026-11-12T12:00:00.000Z")
		);

		expect(toggle).toHaveBeenCalledTimes(1);
		expect(result.completed).toBe(true);
		expect(result.changed).toBe(true);
	});

	it("snapshots a task's data without the Bases entry", () => {
		const task = cardTask();
		const snapshot = cloneSnapshotData(task);

		expect(snapshot).toEqual({ ...task, basesData: undefined });
		expect(snapshot.complete_instances).not.toBe(task.complete_instances);
	});
});
