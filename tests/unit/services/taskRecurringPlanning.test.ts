import {
	applyRecurringTaskCompleteFrontmatterChange,
	applyRecurringTaskSkippedFrontmatterChange,
	buildRecurringTaskCompletePlan,
	buildRecurringTaskSkippedPlan,
	getRecurringTaskActionDate,
} from "../../../src/services/task-service/taskRecurringPlanning";
import type { TaskInfo } from "../../../src/types";
import { getTodayString } from "../../../src/utils/dateUtils";

jest.mock("../../../src/utils/dateUtils", () => ({
	...jest.requireActual("../../../src/utils/dateUtils"),
	getTodayString: jest.fn(),
}));

const mockGetTodayString = getTodayString as jest.MockedFunction<typeof getTodayString>;

function createRecurringTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Recurring task",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Recurring task.md",
		archived: false,
		recurrence: "FREQ=DAILY",
		scheduled: "2026-05-19",
		complete_instances: [],
		skipped_instances: [],
		...overrides,
	} as TaskInfo;
}

describe("taskRecurringPlanning", () => {
	beforeEach(() => {
		mockGetTodayString.mockReturnValue("2026-05-19");
	});

	it("uses the explicit action date when supplied", () => {
		const target = new Date("2026-05-21T12:00:00.000Z");

		expect(getRecurringTaskActionDate(createRecurringTask(), target)).toBe(target);
	});

	it("uses the scheduled date for scheduled-anchor recurring tasks", () => {
		expect(
			getRecurringTaskActionDate(createRecurringTask({ scheduled: "2026-05-22" }))
				.toISOString()
				.slice(0, 10)
		).toBe("2026-05-22");
	});

	it("builds a completion plan that adds the completed instance and advances schedule", () => {
		const plan = buildRecurringTaskCompletePlan({
			freshTask: createRecurringTask({
				skipped_instances: ["2026-05-18", "2026-05-19"],
			}),
			targetDate: new Date("2026-05-19T12:00:00.000Z"),
			currentTimestamp: "2026-05-19T07:15:00+10:00",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.dateStr).toBe("2026-05-19");
		expect(plan.newComplete).toBe(true);
		expect(plan.updatedTask.complete_instances).toEqual(["2026-05-19"]);
		expect(plan.updatedTask.skipped_instances).toEqual(["2026-05-18"]);
		expect(plan.updatedTask.recurrence).toBe("DTSTART:20260519;FREQ=DAILY");
		expect(plan.updatedTask.scheduled).toBe("2026-05-20");
		expect(plan.updatedTask.dateModified).toBe("2026-05-19T07:15:00+10:00");
	});

	it("builds an uncomplete plan that removes completed and skipped state for the date", () => {
		const plan = buildRecurringTaskCompletePlan({
			freshTask: createRecurringTask({
				complete_instances: ["2026-05-18", "2026-05-19"],
				skipped_instances: ["2026-05-19"],
			}),
			targetDate: new Date("2026-05-19T12:00:00.000Z"),
			currentTimestamp: "2026-05-19T07:15:00+10:00",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.newComplete).toBe(false);
		expect(plan.updatedTask.complete_instances).toEqual(["2026-05-18"]);
		expect(plan.updatedTask.skipped_instances).toEqual([]);
	});

	it("updates DTSTART for completion-anchored recurrence plans", () => {
		const plan = buildRecurringTaskCompletePlan({
			freshTask: createRecurringTask({
				recurrence: "DTSTART:20260501;FREQ=DAILY",
				recurrence_anchor: "completion",
			}),
			targetDate: new Date("2026-05-19T12:00:00.000Z"),
			currentTimestamp: "2026-05-19T07:15:00+10:00",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.updatedTask.recurrence).toBe("DTSTART:20260519;FREQ=DAILY");
	});

	it("applies completion frontmatter changes from the plan", () => {
		const plan = buildRecurringTaskCompletePlan({
			freshTask: createRecurringTask({
				skipped_instances: ["2026-05-19"],
			}),
			targetDate: new Date("2026-05-19T12:00:00.000Z"),
			currentTimestamp: "2026-05-19T07:15:00+10:00",
			maintainDueDateOffsetInRecurring: true,
		});
		const frontmatter: Record<string, unknown> = {
			completeInstances: ["2026-05-18"],
			skippedInstances: ["2026-05-19"],
			recurrence: "FREQ=DAILY",
		};

		applyRecurringTaskCompleteFrontmatterChange({
			frontmatter,
			completeInstancesField: "completeInstances",
			skippedInstancesField: "skippedInstances",
			dateModifiedField: "dateModified",
			scheduledField: "scheduled",
			dueField: "due",
			recurrenceField: "recurrence",
			plan,
		});

		expect(frontmatter.completeInstances).toEqual(["2026-05-18", "2026-05-19"]);
		expect(frontmatter.skippedInstances).toEqual([]);
		expect(frontmatter.recurrence).toBe("DTSTART:20260519;FREQ=DAILY");
		expect(frontmatter.scheduled).toBe("2026-05-20");
		expect(frontmatter.dateModified).toBe("2026-05-19T07:15:00+10:00");
	});

	it("builds a skipped plan that adds skipped state, removes completed state, and advances schedule", () => {
		const plan = buildRecurringTaskSkippedPlan({
			freshTask: createRecurringTask({
				complete_instances: ["2026-05-19"],
				skipped_instances: ["2026-05-18"],
			}),
			targetDate: new Date("2026-05-19T12:00:00.000Z"),
			currentTimestamp: "2026-05-19T07:15:00+10:00",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.dateStr).toBe("2026-05-19");
		expect(plan.newSkipped).toBe(true);
		expect(plan.updatedTask.skipped_instances).toEqual(["2026-05-18", "2026-05-19"]);
		expect(plan.updatedTask.complete_instances).toEqual([]);
		expect(plan.updatedTask.scheduled).toBe("2026-05-20");
		expect(plan.updatedTask.dateModified).toBe("2026-05-19T07:15:00+10:00");
	});

	it("builds an unskip plan that removes the skipped date", () => {
		const plan = buildRecurringTaskSkippedPlan({
			freshTask: createRecurringTask({
				skipped_instances: ["2026-05-18", "2026-05-19"],
			}),
			targetDate: new Date("2026-05-19T12:00:00.000Z"),
			currentTimestamp: "2026-05-19T07:15:00+10:00",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.newSkipped).toBe(false);
		expect(plan.updatedTask.skipped_instances).toEqual(["2026-05-18"]);
	});

	it("applies skipped frontmatter changes from the plan", () => {
		const plan = buildRecurringTaskSkippedPlan({
			freshTask: createRecurringTask({
				complete_instances: ["2026-05-19"],
			}),
			targetDate: new Date("2026-05-19T12:00:00.000Z"),
			currentTimestamp: "2026-05-19T07:15:00+10:00",
			maintainDueDateOffsetInRecurring: true,
		});
		const frontmatter: Record<string, unknown> = {
			skippedInstances: [],
			completeInstances: ["2026-05-19"],
		};

		applyRecurringTaskSkippedFrontmatterChange({
			frontmatter,
			skippedField: "skippedInstances",
			completeField: "completeInstances",
			dateModifiedField: "dateModified",
			scheduledField: "scheduled",
			dueField: "due",
			plan,
		});

		expect(frontmatter.skippedInstances).toEqual(["2026-05-19"]);
		expect(frontmatter.completeInstances).toEqual([]);
		expect(frontmatter.scheduled).toBe("2026-05-20");
		expect(frontmatter.dateModified).toBe("2026-05-19T07:15:00+10:00");
	});
});
