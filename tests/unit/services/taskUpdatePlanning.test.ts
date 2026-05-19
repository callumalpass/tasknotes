import type { FieldMappingKey, TaskInfo } from "../../../src/types";
import {
	applyTaskUpdateFrontmatterChange,
	buildTaskUpdateRecurrenceUpdates,
	buildUpdatedTaskFromPlan,
	normalizeTaskUpdateDetails,
	normalizeTaskUpdateInput,
	type TaskUpdateFieldMapper,
} from "../../../src/services/task-service/taskUpdatePlanning";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Original task",
		status: "open",
		priority: "normal",
		path: "Tasks/original.md",
		archived: false,
		tags: ["task", "old"],
		...overrides,
	};
}

function createFieldMapper(): TaskUpdateFieldMapper {
	const mapField = (field: FieldMappingKey): string => {
		const fields: Partial<Record<FieldMappingKey, string>> = {
			title: "title",
			status: "status",
			priority: "priority",
			due: "due",
			scheduled: "scheduled",
			contexts: "contexts",
			projects: "projects",
			timeEstimate: "timeEstimate",
			completedDate: "completedDate",
			dateModified: "dateModified",
			recurrence: "recurrence",
			blockedBy: "blockedBy",
		};
		return fields[field] ?? field;
	};

	return {
		mapToFrontmatter: (taskData, taskTag, storeTitleInFilename) => {
			const frontmatter: Record<string, unknown> = {
				title: taskData.title,
				status: taskData.status,
				priority: taskData.priority,
				due: taskData.due,
				scheduled: taskData.scheduled,
				contexts: taskData.contexts,
				projects: taskData.projects,
				timeEstimate: taskData.timeEstimate,
				completedDate: taskData.completedDate,
				dateModified: taskData.dateModified,
				recurrence: taskData.recurrence,
				blockedBy: taskData.blockedBy,
			};
			if (taskTag) {
				frontmatter.tags = [taskTag, ...((taskData.tags as string[] | undefined) ?? [])];
			}
			if (storeTitleInFilename) {
				delete frontmatter.title;
			}
			return frontmatter;
		},
		toUserField: mapField,
	};
}

describe("taskUpdatePlanning", () => {
	it("sanitizes time entries without mutating the caller's update object", () => {
		const updates = {
			timeEntries: [
				{
					startTime: "2026-05-19T09:00:00.000Z",
					endTime: "2026-05-19T09:30:00.000Z",
					duration: 30,
					description: "Focus",
				},
			],
		};

		const normalized = normalizeTaskUpdateInput(updates);

		expect(normalized.timeEntries).toEqual([
			{
				startTime: "2026-05-19T09:00:00.000Z",
				endTime: "2026-05-19T09:30:00.000Z",
				description: "Focus",
			},
		]);
		expect(updates.timeEntries[0].duration).toBe(30);
	});

	it("normalizes details only when the update explicitly includes details", () => {
		expect(normalizeTaskUpdateDetails({ title: "Renamed" })).toBeNull();
		expect(normalizeTaskUpdateDetails({ details: "Line 1\r\nLine 2" })).toBe(
			"Line 1\nLine 2"
		);
		expect(normalizeTaskUpdateDetails({ details: undefined })).toBe("");
	});

	it("plans recurrence date shifts and DTSTART insertion before the frontmatter write", () => {
		const updateToNextScheduledOccurrenceFn = jest.fn(() => ({
			scheduled: "2026-05-20",
			due: "2026-05-21",
		}));
		const addDTSTARTToRecurrenceRuleFn = jest.fn(() => "DTSTART:20260520;FREQ=WEEKLY");

		const result = buildTaskUpdateRecurrenceUpdates({
			originalTask: createTask({
				recurrence: "FREQ=DAILY",
				scheduled: "2026-05-19",
				due: "2026-05-19",
			}),
			updates: { recurrence: "FREQ=WEEKLY" },
			maintainDueDateOffsetInRecurring: true,
			updateToNextScheduledOccurrenceFn,
			addDTSTARTToRecurrenceRuleFn,
		});

		expect(updateToNextScheduledOccurrenceFn).toHaveBeenCalledWith(
			expect.objectContaining({ recurrence: "FREQ=WEEKLY" }),
			true
		);
		expect(addDTSTARTToRecurrenceRuleFn).toHaveBeenCalledWith(
			expect.objectContaining({
				recurrence: "FREQ=WEEKLY",
				scheduled: "2026-05-20",
				due: "2026-05-21",
			})
		);
		expect(result).toEqual({
			scheduled: "2026-05-20",
			due: "2026-05-21",
			recurrence: "DTSTART:20260520;FREQ=WEEKLY",
		});
	});

	it("adds DTSTART when a scheduled recurring task moves and the rule lacks DTSTART", () => {
		const addDTSTARTToRecurrenceRuleFn = jest.fn(() => "DTSTART:20260521;FREQ=DAILY");

		const result = buildTaskUpdateRecurrenceUpdates({
			originalTask: createTask({
				recurrence: "FREQ=DAILY",
				scheduled: "2026-05-19",
			}),
			updates: { scheduled: "2026-05-21" },
			maintainDueDateOffsetInRecurring: false,
			updateToNextScheduledOccurrenceFn: jest.fn(),
			addDTSTARTToRecurrenceRuleFn,
		});

		expect(addDTSTARTToRecurrenceRuleFn).toHaveBeenCalledWith(
			expect.objectContaining({
				recurrence: "FREQ=DAILY",
				scheduled: "2026-05-21",
			})
		);
		expect(result).toEqual({ recurrence: "DTSTART:20260521;FREQ=DAILY" });
	});

	it("applies mapped updates, custom frontmatter, removals, and task identification", () => {
		const frontmatter: Record<string, unknown> = {
			title: "Old",
			status: "open",
			due: "2026-05-19",
			scheduled: "2026-05-20",
			contexts: ["old"],
			projects: ["old-project"],
			timeEstimate: 30,
			completedDate: "2026-05-18",
			recurrence: "FREQ=DAILY",
			blockedBy: ["[[Other]]"],
			tags: ["task", "old"],
			removeMe: "value",
		};

		const result = applyTaskUpdateFrontmatterChange({
			frontmatter,
			originalTask: createTask({ recurrence: "FREQ=DAILY" }),
			updates: {
				title: "Renamed",
				status: "done",
				due: undefined,
				scheduled: undefined,
				contexts: undefined,
				projects: [],
				timeEstimate: undefined,
				completedDate: undefined,
				recurrence: undefined,
				blockedBy: undefined,
				tags: [],
				customFrontmatter: {
					extra: "kept",
					removeMe: null,
				},
			},
			recurrenceUpdates: {},
			dateModified: "2026-05-19T09:00:00.000Z",
			fieldMapper: createFieldMapper(),
			taskIdentification: {
				method: "property",
				tag: "task",
				propertyName: "isTask",
				propertyValue: "true",
			},
			storeTitleInFilename: true,
			updateCompletedDateInFrontmatter: jest.fn((target) => {
				target.completedDate = "should-not-survive-explicit-removal";
			}),
		});

		expect(frontmatter).toMatchObject({
			status: "done",
			priority: "normal",
			dateModified: "2026-05-19T09:00:00.000Z",
			extra: "kept",
			isTask: true,
		});
		expect(frontmatter).not.toHaveProperty("title");
		expect(frontmatter).not.toHaveProperty("due");
		expect(frontmatter).not.toHaveProperty("scheduled");
		expect(frontmatter).not.toHaveProperty("contexts");
		expect(frontmatter).not.toHaveProperty("projects");
		expect(frontmatter).not.toHaveProperty("timeEstimate");
		expect(frontmatter).not.toHaveProperty("completedDate");
		expect(frontmatter).not.toHaveProperty("recurrence");
		expect(frontmatter).not.toHaveProperty("blockedBy");
		expect(frontmatter).not.toHaveProperty("tags");
		expect(frontmatter).not.toHaveProperty("removeMe");
		expect(result.finalTags).toEqual([]);
	});

	it("builds the returned task state from the same planned mutation", () => {
		const updated = buildUpdatedTaskFromPlan({
			originalTask: createTask({ completedDate: undefined }),
			updates: { status: "done", details: "A\r\nB" },
			recurrenceUpdates: { scheduled: "2026-05-20" },
			newPath: "Tasks/renamed.md",
			dateModified: "2026-05-19T09:00:00.000Z",
			currentDateString: "2026-05-19",
			normalizedDetails: "A\nB",
			finalTags: ["task", "new"],
			isCompletedStatus: (status) => status === "done",
		});

		expect(updated).toMatchObject({
			status: "done",
			scheduled: "2026-05-20",
			path: "Tasks/renamed.md",
			dateModified: "2026-05-19T09:00:00.000Z",
			completedDate: "2026-05-19",
			details: "A\nB",
			tags: ["task", "new"],
		});
	});

	it("clears completedDate in returned task state when reopening a non-recurring task", () => {
		const updated = buildUpdatedTaskFromPlan({
			originalTask: createTask({ status: "done", completedDate: "2026-05-18" }),
			updates: { status: "open" },
			recurrenceUpdates: {},
			newPath: "Tasks/original.md",
			dateModified: "2026-05-19T09:00:00.000Z",
			currentDateString: "2026-05-19",
			normalizedDetails: null,
			isCompletedStatus: (status) => status === "done",
		});

		expect(updated.completedDate).toBeUndefined();
	});
});
