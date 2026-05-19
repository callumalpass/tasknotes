import type { TaskInfo } from "../../../src/types";
import {
	getRecurringOverdueSearchStart,
	hasIncompletePastRecurringInstance,
	isTaskForAgendaDate,
	isTaskOverdueForAgenda,
} from "../../../src/services/filter-service/agendaTaskSelection";
import { parseDateToUTC } from "../../../src/utils/dateUtils";

function task(overrides: Partial<TaskInfo>): TaskInfo {
	return {
		title: "Task",
		path: "Tasks/Task.md",
		status: "open",
		priority: "normal",
		...overrides,
	} as TaskInfo;
}

const isCompletedStatus = (status: string) => status === "done";

describe("agenda task selection", () => {
	it("matches recurring tasks against the requested agenda date", () => {
		const recurring = task({
			scheduled: "2026-05-18",
			recurrence: "FREQ=DAILY;INTERVAL=1",
		});

		expect(
			isTaskForAgendaDate(recurring, {
				dateStr: "2026-05-20",
				isViewingToday: false,
				includeOverdue: false,
				hideCompletedFromOverdue: true,
				isCompletedStatus,
			})
		).toBe(true);
	});

	it("includes overdue non-recurring tasks only when rendering today's agenda section", () => {
		const overdue = task({ due: "2026-05-18", status: "open" });

		expect(
			isTaskForAgendaDate(overdue, {
				dateStr: "2026-05-20",
				isViewingToday: true,
				includeOverdue: true,
				hideCompletedFromOverdue: true,
				isCompletedStatus,
			})
		).toBe(true);

		expect(
			isTaskForAgendaDate(overdue, {
				dateStr: "2026-05-20",
				isViewingToday: false,
				includeOverdue: true,
				hideCompletedFromOverdue: true,
				isCompletedStatus,
			})
		).toBe(false);
	});

	it("hides completed overdue tasks when configured", () => {
		const completed = task({ due: "2026-05-18", status: "done" });

		expect(
			isTaskOverdueForAgenda(completed, {
				hideCompletedFromOverdue: true,
				isCompletedStatus,
				todayString: "2026-05-20",
			})
		).toBe(false);
	});

	it("detects incomplete past recurring instances before today", () => {
		const recurring = task({
			scheduled: "2026-05-18",
			recurrence: "FREQ=DAILY;INTERVAL=1",
			complete_instances: ["2026-05-18"],
			skipped_instances: [],
		});

		expect(hasIncompletePastRecurringInstance(recurring, "2026-05-20")).toBe(true);

		expect(
			hasIncompletePastRecurringInstance(
				{
					...recurring,
					complete_instances: ["2026-05-18", "2026-05-19"],
				},
				"2026-05-20"
			)
		).toBe(false);
	});

	it("uses the earlier of the two-year fallback and task dates as the search start", () => {
		const today = parseDateToUTC("2026-05-20");
		const start = getRecurringOverdueSearchStart(
			task({
				dateCreated: "2023-05-10T12:00:00",
				scheduled: "2026-05-12",
				due: "2026-05-11",
			}),
			today
		);

		expect(start.toISOString()).toBe("2023-05-10T00:00:00.000Z");
	});
});
