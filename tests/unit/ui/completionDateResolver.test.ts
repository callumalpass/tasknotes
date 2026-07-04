import { resolveCompletionDate } from "../../../src/ui/completionDateResolver";
import { formatDateForStorage, getTodayString } from "../../../src/utils/dateUtils";
import type { TaskInfo } from "../../../src/types";

/**
 * U3 — the four-mode completion-date resolver (KTD1). Modes resolve to a concrete
 * date; `asScheduled`/`onDue` report unavailable (never silently substitute)
 * when their source is absent, so the menu can disable the option (R4).
 */

function task(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		id: "Tasks/t.md",
		path: "Tasks/t.md",
		title: "T",
		status: "open",
		priority: "normal",
		...overrides,
	} as TaskInfo;
}

describe("U3: resolveCompletionDate", () => {
	describe("today", () => {
		it("resolves to today for recurring and non-recurring", () => {
			const nonRecurring = resolveCompletionDate(task({ scheduled: "2026-06-02" }), "today");
			const recurring = resolveCompletionDate(
				task({ recurrence: "DTSTART:20260601;FREQ=WEEKLY;BYDAY=TU", scheduled: "2026-06-02" }),
				"today"
			);
			expect(nonRecurring.available).toBe(true);
			expect(recurring.available).toBe(true);
			if (nonRecurring.available) {
				expect(formatDateForStorage(nonRecurring.date)).toBe(getTodayString());
			}
		});
	});

	describe("asScheduled", () => {
		it("resolves to the task scheduled date when present", () => {
			const result = resolveCompletionDate(task({ scheduled: "2026-06-02" }), "asScheduled");
			expect(result).toEqual({ available: true, date: expect.any(Date) });
			if (result.available) {
				expect(formatDateForStorage(result.date)).toBe("2026-06-02");
			}
		});

		it("prefers the clicked occurrence over the task scheduled date", () => {
			const occurrenceDate = new Date("2026-06-09T00:00:00Z");
			const result = resolveCompletionDate(
				task({ recurrence: "x", scheduled: "2026-06-02" }),
				"asScheduled",
				{ occurrenceDate }
			);
			if (result.available) {
				expect(formatDateForStorage(result.date)).toBe("2026-06-09");
			} else {
				throw new Error("expected available");
			}
		});

		it("is unavailable when there is no scheduled date (including due-only recurring)", () => {
			const nonRecurring = resolveCompletionDate(task({ due: "2026-06-02" }), "asScheduled");
			const dueOnlyRecurring = resolveCompletionDate(
				task({ recurrence: "x", due: "2026-06-02" }),
				"asScheduled"
			);
			expect(nonRecurring).toEqual({
				available: false,
				reasonKey: "contextMenus.task.completion.noScheduledDate",
			});
			expect(dueOnlyRecurring.available).toBe(false);
		});

		it("never falls through to due", () => {
			const result = resolveCompletionDate(task({ due: "2026-06-30" }), "asScheduled");
			expect(result.available).toBe(false);
		});

		it("resolves to scheduled for a completion-anchored recurrence (explicit re-anchor)", () => {
			const result = resolveCompletionDate(
				task({
					recurrence: "x",
					recurrence_anchor: "completion",
					scheduled: "2026-06-02",
				}),
				"asScheduled"
			);
			if (result.available) {
				expect(formatDateForStorage(result.date)).toBe("2026-06-02");
			} else {
				throw new Error("expected available");
			}
		});
	});

	describe("onDue", () => {
		it("resolves to the due date when present", () => {
			const result = resolveCompletionDate(task({ due: "2026-06-30" }), "onDue");
			if (result.available) {
				expect(formatDateForStorage(result.date)).toBe("2026-06-30");
			} else {
				throw new Error("expected available");
			}
		});

		it("is unavailable when there is no due date", () => {
			const result = resolveCompletionDate(task({ scheduled: "2026-06-02" }), "onDue");
			expect(result).toEqual({
				available: false,
				reasonKey: "contextMenus.task.completion.noDueDate",
			});
		});
	});

	it("asScheduled and onDue never resolve to the same date when both exist", () => {
		const t = task({ scheduled: "2026-06-02", due: "2026-06-30" });
		const scheduled = resolveCompletionDate(t, "asScheduled");
		const due = resolveCompletionDate(t, "onDue");
		expect(scheduled.available && due.available).toBe(true);
		if (scheduled.available && due.available) {
			expect(formatDateForStorage(scheduled.date)).not.toBe(formatDateForStorage(due.date));
		}
	});

	describe("onPicked", () => {
		it("returns the picked date, preserving time", () => {
			const pickedDate = new Date("2026-05-20T14:30:00Z");
			const result = resolveCompletionDate(task(), "onPicked", { pickedDate });
			expect(result).toEqual({ available: true, date: pickedDate });
		});

		it("is unavailable when no date was picked", () => {
			const result = resolveCompletionDate(task(), "onPicked");
			expect(result).toEqual({
				available: false,
				reasonKey: "contextMenus.task.completion.noPickedDate",
			});
		});
	});
});
