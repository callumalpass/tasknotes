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

function createMovedWeeklyTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return createRecurringTask({
		recurrence: "DTSTART:20260406;FREQ=WEEKLY;BYDAY=MO",
		scheduled: "2026-04-10",
		googleCalendarExceptionOriginalScheduled: "2026-04-13",
		...overrides,
	});
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

	it("reports the owning recurrence date when a shifted target is completed", () => {
		const plan = buildRecurringTaskCompletePlan({
			freshTask: createRecurringTask({
				recurrence: "DTSTART:20260802;FREQ=WEEKLY;BYDAY=SU",
				scheduled: "2026-08-04",
			}),
			targetDate: new Date("2026-08-04T12:00:00.000Z"),
			currentTimestamp: "2026-08-04T12:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

		expect(plan.dateStr).toBe("2026-08-02");
		expect(plan.newComplete).toBe(true);
		expect(plan.updatedTask.complete_instances).toEqual(["2026-08-02"]);
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

	describe("Google Calendar occurrences moved before their series date", () => {
		beforeEach(() => {
			mockGetTodayString.mockReturnValue("2026-04-10");
		});

		it("completes the moved date and advances past the replaced series date", () => {
			const plan = buildRecurringTaskCompletePlan({
				freshTask: createMovedWeeklyTask(),
				targetDate: new Date("2026-04-10T12:00:00.000Z"),
				currentTimestamp: "2026-04-10T12:30:00.000Z",
				maintainDueDateOffsetInRecurring: true,
			});

			expect(plan.updatedTask.complete_instances).toEqual(["2026-04-10"]);
			expect(plan.updatedTask.skipped_instances).toEqual([]);
			expect(plan.updatedTask.scheduled).toBe("2026-04-20");
			expect(plan.updatedTask.googleCalendarMovedOriginalDates).toEqual(["2026-04-13"]);
			expect(plan.updatedTask.googleCalendarExceptionOriginalScheduled).toBeUndefined();
		});

		it("skips the moved date and advances past the replaced series date", () => {
			const plan = buildRecurringTaskSkippedPlan({
				freshTask: createMovedWeeklyTask(),
				targetDate: new Date("2026-04-10T12:00:00.000Z"),
				currentTimestamp: "2026-04-10T12:30:00.000Z",
				maintainDueDateOffsetInRecurring: true,
			});

			expect(plan.updatedTask.skipped_instances).toEqual(["2026-04-10"]);
			expect(plan.updatedTask.complete_instances).toEqual([]);
			expect(plan.updatedTask.scheduled).toBe("2026-04-20");
			expect(plan.updatedTask.googleCalendarMovedOriginalDates).toEqual(["2026-04-13"]);
			expect(plan.updatedTask.googleCalendarExceptionOriginalScheduled).toBeUndefined();
		});

		it("keeps the replaced date excluded after intervening occurrences", () => {
			const movedPlan = buildRecurringTaskCompletePlan({
				freshTask: createMovedWeeklyTask({
					recurrence: "DTSTART:20260409;FREQ=DAILY",
				}),
				targetDate: new Date("2026-04-10T12:00:00.000Z"),
				currentTimestamp: "2026-04-10T12:30:00.000Z",
				maintainDueDateOffsetInRecurring: true,
			});
			const interveningPlan = buildRecurringTaskCompletePlan({
				freshTask: movedPlan.updatedTask,
				targetDate: new Date("2026-04-11T12:00:00.000Z"),
				currentTimestamp: "2026-04-11T12:30:00.000Z",
				maintainDueDateOffsetInRecurring: true,
			});
			const beforeReplacedDatePlan = buildRecurringTaskCompletePlan({
				freshTask: interveningPlan.updatedTask,
				targetDate: new Date("2026-04-12T12:00:00.000Z"),
				currentTimestamp: "2026-04-12T12:30:00.000Z",
				maintainDueDateOffsetInRecurring: true,
			});

			expect(movedPlan.updatedTask.scheduled).toBe("2026-04-11");
			expect(interveningPlan.updatedTask.scheduled).toBe("2026-04-12");
			expect(beforeReplacedDatePlan.updatedTask.scheduled).toBe("2026-04-14");
			expect(beforeReplacedDatePlan.updatedTask.complete_instances).toEqual([
				"2026-04-10",
				"2026-04-11",
				"2026-04-12",
			]);
			expect(beforeReplacedDatePlan.updatedTask.skipped_instances).toEqual([]);
			expect(beforeReplacedDatePlan.updatedTask.googleCalendarMovedOriginalDates).toEqual([
				"2026-04-13",
			]);
		});

		it("does not persist the replaced series date when uncompleting or unskipping", () => {
			const completePlan = buildRecurringTaskCompletePlan({
				freshTask: createMovedWeeklyTask({ complete_instances: ["2026-04-10"] }),
				targetDate: new Date("2026-04-10T12:00:00.000Z"),
				currentTimestamp: "2026-04-10T12:30:00.000Z",
				maintainDueDateOffsetInRecurring: true,
			});
			const skipPlan = buildRecurringTaskSkippedPlan({
				freshTask: createMovedWeeklyTask({ skipped_instances: ["2026-04-10"] }),
				targetDate: new Date("2026-04-10T12:00:00.000Z"),
				currentTimestamp: "2026-04-10T12:30:00.000Z",
				maintainDueDateOffsetInRecurring: true,
			});

			expect(completePlan.newComplete).toBe(false);
			expect(completePlan.updatedTask.complete_instances).toEqual([]);
			expect(completePlan.updatedTask.skipped_instances).toEqual([]);
			expect(skipPlan.newSkipped).toBe(false);
			expect(skipPlan.updatedTask.complete_instances).toEqual([]);
			expect(skipPlan.updatedTask.skipped_instances).toEqual([]);
			for (const plan of [completePlan, skipPlan]) {
				expect(plan.updatedTask.scheduled).toBe("2026-04-20");
				expect(plan.updatedTask.complete_instances).not.toContain("2026-04-13");
				expect(plan.updatedTask.skipped_instances).not.toContain("2026-04-13");
			}
		});

		it("preserves the moved date's due offset when advancing", () => {
			const plan = buildRecurringTaskCompletePlan({
				freshTask: createMovedWeeklyTask({ due: "2026-04-12" }),
				targetDate: new Date("2026-04-10T12:00:00.000Z"),
				currentTimestamp: "2026-04-10T12:30:00.000Z",
				maintainDueDateOffsetInRecurring: true,
			});

			expect(plan.updatedTask.scheduled).toBe("2026-04-20");
			expect(plan.updatedTask.due).toBe("2026-04-22");
		});

		it("keeps later moved occurrences advancing normally", () => {
			const plan = buildRecurringTaskCompletePlan({
				freshTask: createMovedWeeklyTask({ scheduled: "2026-04-15" }),
				targetDate: new Date("2026-04-15T12:00:00.000Z"),
				currentTimestamp: "2026-04-15T12:30:00.000Z",
				maintainDueDateOffsetInRecurring: true,
			});

			expect(plan.updatedTask.complete_instances).toEqual(["2026-04-15"]);
			expect(plan.updatedTask.scheduled).toBe("2026-04-20");
		});

		it("does not change completion-anchored recurrence calculation", () => {
			const baseTask = createMovedWeeklyTask({ recurrence_anchor: "completion" });
			const withoutGoogleException = {
				...baseTask,
				googleCalendarExceptionOriginalScheduled: undefined,
			};
			const input = {
				targetDate: new Date("2026-04-10T12:00:00.000Z"),
				currentTimestamp: "2026-04-10T12:30:00.000Z",
				maintainDueDateOffsetInRecurring: true,
			};

			const withException = buildRecurringTaskCompletePlan({
				freshTask: baseTask,
				...input,
			});
			const withoutException = buildRecurringTaskCompletePlan({
				freshTask: withoutGoogleException,
				...input,
			});

			expect(withException.updatedTask.scheduled).toBe(
				withoutException.updatedTask.scheduled
			);
			expect(withException.updatedTask.recurrence).toBe(
				withoutException.updatedTask.recurrence
			);
		});
	});
});
