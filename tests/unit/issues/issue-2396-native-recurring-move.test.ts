/**
 * Issue #2396: moving a native (virtual) recurring occurrence must replace the
 * original rule occurrence, keeping the original rule date as its stable identity
 * for calendar suppression, completion, skip and Undo.
 *
 * The identity is persisted in `recurrence_original_date` while a moved
 * occurrence is pending. Google Calendar's own marker path stays unchanged.
 */

import { deserialize, serialize } from "node:v8";

// Exercise the real recurrence engine, not the global simplified RRULE mock.
jest.mock("rrule", () => jest.requireActual("rrule/dist/es5/rrule.js"));
jest.mock("../../../src/utils/dateUtils", () => ({
	...jest.requireActual("../../../src/utils/dateUtils"),
	getTodayString: jest.fn(),
}));

import { generateRecurringTaskInstances, type CalendarEvent } from "../../../src/bases/calendar-core";
import { getKanbanTaskActionDate } from "../../../src/bases/kanbanCardActions";
import { FieldMapper } from "../../../src/core/FieldMapper";
import type TaskNotesPlugin from "../../../src/main";
import { TaskService } from "../../../src/services/TaskService";
import {
	buildCompletionContentUndo,
	completeRecurringTaskWithUndo,
	readCompletionContent,
	restoreCompletionContent,
} from "../../../src/services/task-service/recurringCompletionUndo";
import {
	applyRecurringMoveForScheduledChange,
	clearRecurringMoveAfterSeriesChange,
	getRecurringMoveOriginalDate,
	resolveRecurringMoveAfterAction,
	resolveRecurringMoveDate,
} from "../../../src/services/task-service/recurringMoveIdentity";
import {
	applyRecurringTaskCompleteFrontmatterChange,
	applyRecurringTaskSkippedFrontmatterChange,
	buildRecurringTaskCompletePlan,
	buildRecurringTaskSkippedPlan,
	getRecurringTaskActionDate,
} from "../../../src/services/task-service/taskRecurringPlanning";
import {
	applyTaskUpdateFrontmatterChange,
	buildTaskUpdateRecurrenceUpdates,
} from "../../../src/services/task-service/taskUpdatePlanning";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import type { TaskInfo } from "../../../src/types";
import { buildTaskCardRenderState, getDefaultTaskCardTargetDate } from "../../../src/ui/taskCardState";
import { getTodayString } from "../../../src/utils/dateUtils";
import { PluginFactory } from "../../helpers/mock-factories";
import { TFile, stringifyYaml } from "../../helpers/obsidian-runtime";

const mockGetTodayString = getTodayString as jest.MockedFunction<typeof getTodayString>;

const PATH = "Tasks/Annual.md";
const RULE = "DTSTART:20261018;FREQ=YEARLY";
const TIMED_RULE = "DTSTART:20261018T090000Z;FREQ=YEARLY";
const WEEKLY_RULE = "DTSTART:20261012;FREQ=WEEKLY;BYDAY=MO";

function annual(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Annual",
		status: "open",
		priority: "normal",
		path: PATH,
		archived: false,
		recurrence: RULE,
		scheduled: "2026-10-18",
		complete_instances: [],
		skipped_instances: [],
		...overrides,
	};
}

/** Annual task already moved from its 18 October rule date to 12 October. */
function moved(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return annual({
		scheduled: "2026-10-12",
		recurrence_original_date: "2026-10-18",
		...overrides,
	});
}

/** Weekly (Monday) task whose 12 October occurrence was moved onto the 19 October rule date. */
function movedOntoRuleDate(): TaskInfo {
	return annual({
		recurrence: WEEKLY_RULE,
		scheduled: "2026-10-19",
		recurrence_original_date: "2026-10-12",
	});
}

/** Apply a schedule move the way the update paths do and return the resulting task. */
function move(task: TaskInfo, scheduled: string): TaskInfo {
	const updated: TaskInfo = { ...task, scheduled };
	applyRecurringMoveForScheduledChange(task, updated);
	return updated;
}

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function complete(task: TaskInfo, target: Date = getRecurringTaskActionDate(task)) {
	return buildRecurringTaskCompletePlan({
		freshTask: task,
		targetDate: target,
		currentTimestamp: "2026-10-12T08:00:00.000Z",
		maintainDueDateOffsetInRecurring: false,
	});
}

function skip(task: TaskInfo, target: Date = getRecurringTaskActionDate(task)) {
	return buildRecurringTaskSkippedPlan({
		freshTask: task,
		targetDate: target,
		currentTimestamp: "2026-10-12T08:00:00.000Z",
		maintainDueDateOffsetInRecurring: false,
	});
}

function update(originalTask: TaskInfo, updates: Parameters<typeof buildTaskUpdateRecurrenceUpdates>[0]["updates"]) {
	return buildTaskUpdateRecurrenceUpdates({
		originalTask,
		updates,
		maintainDueDateOffsetInRecurring: false,
	});
}

beforeEach(() => {
	// Mid-week of the issue report: the moved occurrence is one week early.
	mockGetTodayString.mockReturnValue("2026-10-12");
});

describe("issue #2396 recurringMoveIdentity", () => {
	describe("applyRecurringMoveForScheduledChange", () => {
		it("captures the exact rule occurrence on the first move", () => {
			const updated = move(annual(), "2026-10-12");

			expect(updated.scheduled).toBe("2026-10-12");
			expect(updated.recurrence_original_date).toBe("2026-10-18");
			expect(updated.recurrence).toBe(RULE);
		});

		it("pins a DTSTART-less rule to the original date, not the moved date", () => {
			const updated = move(annual({ recurrence: "FREQ=YEARLY" }), "2026-10-12");

			expect(updated.recurrence).toBe("DTSTART:20261018;FREQ=YEARLY");
			expect(updated.recurrence_original_date).toBe("2026-10-18");
		});

		it("reuses the identity when the occurrence moves again, including across cycles", () => {
			const first = move(annual(), "2026-10-12");
			const second = move(first, "2026-10-14");
			const crossCycle = move(second, "2027-03-01");

			expect(second.recurrence_original_date).toBe("2026-10-18");
			expect(crossCycle.recurrence_original_date).toBe("2026-10-18");
			expect(crossCycle.scheduled).toBe("2027-03-01");
		});

		it("keeps the original identity when a move lands on another rule date", () => {
			const original = annual({ recurrence: WEEKLY_RULE, scheduled: "2026-10-12" });

			expect(move(original, "2026-10-19").recurrence_original_date).toBe("2026-10-12");
		});

		it("removes the marker when the occurrence moves back to its original calendar date", () => {
			const back = move(moved(), "2026-10-18");

			expect(back.scheduled).toBe("2026-10-18");
			expect(back.recurrence_original_date).toBeUndefined();
		});

		it("keeps the calendar day stable for time-only changes and compares days when timed", () => {
			const timed = annual({ recurrence: TIMED_RULE, scheduled: "2026-10-18T09:00" });

			expect(move(timed, "2026-10-18T10:30").recurrence_original_date).toBeUndefined();

			const first = move(timed, "2026-10-12T09:00");
			expect(first.recurrence_original_date).toBe("2026-10-18");
			const retimed = move(first, "2026-10-12T14:30");
			expect(retimed.recurrence_original_date).toBe("2026-10-18");
			const back = move(retimed, "2026-10-18T14:30");
			expect(back.scheduled).toBe("2026-10-18T14:30");
			expect(back.recurrence_original_date).toBeUndefined();
		});

		it("handles minute-precision timed schedules without a DTSTART (#2328)", () => {
			const updated = move(annual({ recurrence: "FREQ=YEARLY", scheduled: "2026-10-18T09:00" }), "2026-10-12T09:00");

			expect(updated.recurrence).toBe(TIMED_RULE);
			expect(updated.recurrence_original_date).toBe("2026-10-18");
		});

		it("does not guess an identity for a legacy off-pattern schedule without a marker", () => {
			const legacy = annual({ scheduled: "2026-10-12" });

			expect(move(legacy, "2026-10-14").recurrence_original_date).toBeUndefined();
		});

		it("ignores a malformed marker instead of trusting or guessing it", () => {
			const malformed = annual({ scheduled: "2026-10-12", recurrence_original_date: "2026-02-30" });

			expect(getRecurringMoveOriginalDate(malformed)).toBeUndefined();
			expect(move(malformed, "2026-10-14").recurrence_original_date).toBeUndefined();
		});

		it("is not applied to completion-anchored, non-recurring or unscheduled tasks", () => {
			expect(move(annual({ recurrence_anchor: "completion" }), "2026-10-12").recurrence_original_date)
				.toBeUndefined();
			expect(move(annual({ recurrence: undefined }), "2026-10-12").recurrence_original_date)
				.toBeUndefined();

			const cleared: TaskInfo = { ...moved(), scheduled: undefined };
			applyRecurringMoveForScheduledChange(moved(), cleared);
			expect(cleared.recurrence_original_date).toBeUndefined();
		});

		it("does not carry a marker into an edit that also changes the rule", () => {
			const original = annual();
			const updated: TaskInfo = {
				...original,
				scheduled: "2026-10-12",
				recurrence: "DTSTART:20261018;FREQ=MONTHLY",
			};

			applyRecurringMoveForScheduledChange(original, updated);

			expect(updated.recurrence_original_date).toBeUndefined();
		});

		it("leaves Google-projected tasks to the Google marker path", () => {
			const google = annual({ googleCalendarEventId: "master-event-id" });
			const updated = move(google, "2026-10-12");

			expect(updated.recurrence_original_date).toBeUndefined();
		});
	});

	describe("clearRecurringMoveAfterSeriesChange", () => {
		it.each([
			["rule", { recurrence: "DTSTART:20261018;FREQ=MONTHLY" }],
			["anchor", { recurrence_anchor: "completion" as const }],
			["removed rule", { recurrence: undefined }],
			["removed schedule", { scheduled: undefined }],
		])("clears the marker when the %s changes", (_label, change) => {
			const original = moved();
			const updated: TaskInfo = { ...original, ...change };

			clearRecurringMoveAfterSeriesChange(original, updated);

			expect(updated.recurrence_original_date).toBeUndefined();
		});

		it("keeps the marker when the series is unchanged", () => {
			const original = moved();
			const updated: TaskInfo = { ...original, recurrence: original.recurrence };

			clearRecurringMoveAfterSeriesChange(original, updated);

			expect(updated.recurrence_original_date).toBe("2026-10-18");
		});
	});

	describe("resolveRecurringMoveDate / resolveRecurringMoveAfterAction", () => {
		it("resolves only the known pending placement to the original date", () => {
			const task = moved();

			expect(resolveRecurringMoveDate(task, "2026-10-12")).toBe("2026-10-18");
			expect(resolveRecurringMoveDate(task, "2026-10-18")).toBe("2026-10-18");
			expect(resolveRecurringMoveDate(task, "2027-10-18")).toBe("2027-10-18");
			expect(resolveRecurringMoveDate(annual(), "2026-10-12")).toBe("2026-10-12");
			expect(
				resolveRecurringMoveDate(moved({ recurrence_anchor: "completion" }), "2026-10-12")
			).toBe("2026-10-12");
		});

		it("clears the marker once the schedule advanced and keeps it otherwise", () => {
			const advanced: TaskInfo = { ...moved(), scheduled: "2027-10-18" };
			resolveRecurringMoveAfterAction(moved(), advanced);
			expect(advanced.recurrence_original_date).toBeUndefined();

			const unchanged: TaskInfo = { ...moved() };
			resolveRecurringMoveAfterAction(moved(), unchanged);
			expect(unchanged.recurrence_original_date).toBe("2026-10-18");
		});
	});
});

describe("issue #2396 completion and skip of a moved occurrence", () => {
	it("resolves the action date of a moved occurrence to its original date", () => {
		const task = moved();

		expect(getRecurringTaskActionDate(task).toISOString().slice(0, 10)).toBe("2026-10-18");
		expect(getRecurringTaskActionDate(task, day("2026-10-12")).toISOString().slice(0, 10)).toBe("2026-10-18");
		expect(getRecurringTaskActionDate(task, day("2026-10-18")).toISOString().slice(0, 10)).toBe("2026-10-18");
		expect(getRecurringTaskActionDate(task, day("2027-10-18")).toISOString().slice(0, 10)).toBe("2027-10-18");
		expect(getRecurringTaskActionDate(annual()).toISOString().slice(0, 10)).toBe("2026-10-18");
	});

	it("records the original date when a moved occurrence is completed, then clears the marker", () => {
		const plan = complete(moved());

		expect(plan.dateStr).toBe("2026-10-18");
		expect(plan.updatedTask.complete_instances).toEqual(["2026-10-18"]);
		expect(plan.updatedTask.scheduled).toBe("2027-10-18");
		expect(plan.updatedTask.recurrence).toBe(RULE);
		expect(plan.updatedTask.recurrence_original_date).toBeUndefined();
	});

	it("records the original date when a moved occurrence is skipped, then clears the marker", () => {
		const plan = skip(moved());

		expect(plan.dateStr).toBe("2026-10-18");
		expect(plan.updatedTask.skipped_instances).toEqual(["2026-10-18"]);
		expect(plan.updatedTask.complete_instances).toEqual([]);
		expect(plan.updatedTask.scheduled).toBe("2027-10-18");
		expect(plan.updatedTask.recurrence_original_date).toBeUndefined();
	});

	it("resolves a plan built from the moved placement date directly", () => {
		expect(complete(moved(), day("2026-10-12")).dateStr).toBe("2026-10-18");
		expect(skip(moved(), day("2026-10-12")).dateStr).toBe("2026-10-18");
	});

	it("keeps the identity when the occurrence was moved into a later cycle", () => {
		const crossCycle = moved({ scheduled: "2027-03-01" });
		const plan = complete(crossCycle);

		expect(plan.dateStr).toBe("2026-10-18");
		expect(plan.updatedTask.complete_instances).toEqual(["2026-10-18"]);
		expect(plan.updatedTask.scheduled).toBe("2027-10-18");
		expect(plan.updatedTask.recurrence_original_date).toBeUndefined();
	});

	it("keeps minute-precision timed schedules stable (#2328)", () => {
		const timed = annual({
			recurrence: TIMED_RULE,
			scheduled: "2026-10-12T09:00",
			recurrence_original_date: "2026-10-18",
		});
		const plan = complete(timed);

		expect(plan.dateStr).toBe("2026-10-18");
		expect(plan.updatedTask.scheduled).toBe("2027-10-18T09:00");
		expect(plan.updatedTask.recurrence_original_date).toBeUndefined();
	});

	it("keeps the marker when an exhausted series leaves the completed occurrence in place", () => {
		const finite = moved({ recurrence: "DTSTART:20261018;FREQ=DAILY;COUNT=1" });

		const completed = complete(finite);
		expect(completed.updatedTask.complete_instances).toEqual(["2026-10-18"]);
		expect(completed.updatedTask.scheduled).toBe("2026-10-12");
		expect(completed.updatedTask.recurrence_original_date).toBe("2026-10-18");

		const skipped = skip(finite);
		expect(skipped.updatedTask.skipped_instances).toEqual(["2026-10-18"]);
		expect(skipped.updatedTask.scheduled).toBe("2026-10-12");
		expect(skipped.updatedTask.recurrence_original_date).toBe("2026-10-18");
	});

	it("toggles the same identity off again for a retained completed occurrence", () => {
		const done = moved({
			recurrence: "DTSTART:20261018;FREQ=DAILY;COUNT=1",
			complete_instances: ["2026-10-18"],
		});
		const plan = complete(done);

		expect(plan.dateStr).toBe("2026-10-18");
		expect(plan.newComplete).toBe(false);
		expect(plan.updatedTask.complete_instances).toEqual([]);
		expect(plan.updatedTask.scheduled).toBe("2026-10-12");
		expect(plan.updatedTask.recurrence_original_date).toBe("2026-10-18");
	});

	it("clears the marker when completing leaves the schedule on the next real occurrence's date", () => {
		// Monday 12 Oct moved onto Monday 19 Oct. Completing the moved occurrence
		// advances the series to the real 19 Oct occurrence, which has the same
		// date as the old placement. That date is then a real occurrence again, not
		// a pending move of 12 Oct.
		const completed = complete(movedOntoRuleDate());
		expect(completed.dateStr).toBe("2026-10-12");
		expect(completed.updatedTask.complete_instances).toEqual(["2026-10-12"]);
		expect(completed.updatedTask.scheduled).toBe("2026-10-19");
		expect(completed.updatedTask.recurrence_original_date).toBeUndefined();

		const skipped = skip(movedOntoRuleDate());
		expect(skipped.dateStr).toBe("2026-10-12");
		expect(skipped.updatedTask.skipped_instances).toEqual(["2026-10-12"]);
		expect(skipped.updatedTask.scheduled).toBe("2026-10-19");
		expect(skipped.updatedTask.recurrence_original_date).toBeUndefined();
	});

	it.each(["complete", "skip"] as const)(
		"explicit landing-date %s processes the real pattern occurrence without abandoning the moved one",
		(action) => {
			const task = movedOntoRuleDate();
			const target = getRecurringTaskActionDate(task, day("2026-10-19"));

			expect(resolveRecurringMoveDate(task, "2026-10-19")).toBe("2026-10-19");
			expect(target).toEqual(day("2026-10-19"));
			expect(getRecurringTaskActionDate(task)).toEqual(day("2026-10-12"));

			const plan = action === "complete" ? complete(task, target) : skip(task, target);
			expect(plan.dateStr).toBe("2026-10-19");
			expect(plan.updatedTask.complete_instances).toEqual(action === "complete" ? ["2026-10-19"] : []);
			expect(plan.updatedTask.skipped_instances).toEqual(action === "skip" ? ["2026-10-19"] : []);
			expect(plan.updatedTask.scheduled).toBe("2026-10-19");
			expect(plan.updatedTask.recurrence_original_date).toBe("2026-10-12");
			expect(plan.updatedTask.recurrence).toBe(WEEKLY_RULE);

			// With no explicit date the pending original still owns the action.
			// The already processed real 19 October occurrence must not be offered again.
			expect(getRecurringTaskActionDate(plan.updatedTask)).toEqual(day("2026-10-12"));
			const completed = complete(plan.updatedTask);
			expect(completed.dateStr).toBe("2026-10-12");
			expect(completed.newComplete).toBe(true);
			expect(completed.updatedTask.complete_instances).toEqual(
				action === "complete" ? ["2026-10-19", "2026-10-12"] : ["2026-10-12"]
			);
			expect(completed.updatedTask.skipped_instances).toEqual(action === "skip" ? ["2026-10-19"] : []);
			expect(completed.updatedTask.scheduled).toBe("2026-10-26");
			expect(completed.updatedTask.recurrence_original_date).toBeUndefined();
			expect(completed.updatedTask.recurrence).toBe(WEEKLY_RULE);
		}
	);

	it("keeps the existing heuristic for an unmarked later shift", () => {
		const legacy = annual({ scheduled: "2026-10-20" });
		const plan = complete(legacy);

		expect(plan.dateStr).toBe("2026-10-18");
		expect(plan.updatedTask.complete_instances).toEqual(["2026-10-18"]);
	});

	it("leaves the Google moved-exception completion storage unchanged", () => {
		const google = annual({
			scheduled: "2026-10-12",
			googleCalendarEventId: "master-event-id",
			googleCalendarExceptionOriginalScheduled: "2026-10-18",
		});
		const plan = complete(google);

		expect(plan.dateStr).toBe("2026-10-12");
		expect(plan.updatedTask.complete_instances).toEqual(["2026-10-12"]);
		expect(plan.updatedTask.complete_instances).not.toContain("2026-10-18");
		expect(plan.updatedTask.recurrence_original_date).toBeUndefined();
	});

	it("removes or keeps the marker in frontmatter with the configured property name", () => {
		const fields = {
			completeInstancesField: "complete_instances",
			skippedInstancesField: "skipped_instances",
			dateModifiedField: "dateModified",
			scheduledField: "scheduled",
			dueField: "due",
			recurrenceField: "recurrence",
			recurrenceOriginalDateField: "moved_from",
			googleCalendarExceptionOriginalScheduledField: "googleCalendarExceptionOriginalScheduled",
			googleCalendarMovedOriginalDatesField: "googleCalendarMovedOriginalDates",
		};
		const base = () => ({
			recurrence: RULE,
			scheduled: "2026-10-12",
			moved_from: "2026-10-18",
			complete_instances: [] as string[],
			skipped_instances: [] as string[],
		});

		const advanced: Record<string, unknown> = base();
		applyRecurringTaskCompleteFrontmatterChange({ ...fields, frontmatter: advanced, plan: complete(moved()) });
		expect(advanced).not.toHaveProperty("moved_from");
		expect(advanced.scheduled).toBe("2027-10-18");
		expect(advanced.complete_instances).toEqual(["2026-10-18"]);

		const retained: Record<string, unknown> = base();
		applyRecurringTaskCompleteFrontmatterChange({
			...fields,
			frontmatter: retained,
			plan: complete(moved({ recurrence: "DTSTART:20261018;FREQ=DAILY;COUNT=1" })),
		});
		expect(retained.moved_from).toBe("2026-10-18");

		const skipped: Record<string, unknown> = base();
		applyRecurringTaskSkippedFrontmatterChange({
			frontmatter: skipped,
			skippedField: "skipped_instances",
			completeField: "complete_instances",
			dateModifiedField: "dateModified",
			scheduledField: "scheduled",
			dueField: "due",
			recurrenceOriginalDateField: "moved_from",
			googleCalendarExceptionOriginalScheduledField: "googleCalendarExceptionOriginalScheduled",
			googleCalendarMovedOriginalDatesField: "googleCalendarMovedOriginalDates",
			plan: skip(moved()),
		});
		expect(skipped).not.toHaveProperty("moved_from");
		expect(skipped.skipped_instances).toEqual(["2026-10-18"]);
	});
});

describe("issue #2396 buildTaskUpdateRecurrenceUpdates", () => {
	it("records the original date for a single schedule move", () => {
		const result = update(annual(), { scheduled: "2026-10-12" });

		expect(result.recurrence_original_date).toBe("2026-10-18");
	});

	it("records the original date for a multi-field edit", () => {
		const result = update(annual(), { scheduled: "2026-10-12", priority: "high", title: "Renamed" });

		expect(result.recurrence_original_date).toBe("2026-10-18");
	});

	it("pins a DTSTART-less rule to the original date and keeps timed precision (#2328)", () => {
		const result = update(
			annual({ recurrence: "FREQ=YEARLY", scheduled: "2026-10-18T09:00" }),
			{ scheduled: "2026-10-12T09:00" }
		);

		expect(result.recurrence).toBe(TIMED_RULE);
		expect(result.recurrence_original_date).toBe("2026-10-18");
	});

	it("reuses the marker on a second move and signals its removal when moved back", () => {
		const second = update(moved(), { scheduled: "2026-10-14" });
		expect(second.recurrence_original_date).toBe("2026-10-18");

		const back = update(moved(), { scheduled: "2026-10-18" });
		expect(Object.prototype.hasOwnProperty.call(back, "recurrence_original_date")).toBe(true);
		expect(back.recurrence_original_date).toBeUndefined();
	});

	it("keeps the marker for time-only changes and writes none for an unmarked task", () => {
		const timedMoved = annual({
			recurrence: TIMED_RULE,
			scheduled: "2026-10-12T09:00",
			recurrence_original_date: "2026-10-18",
		});
		expect(update(timedMoved, { scheduled: "2026-10-12T14:30" }).recurrence_original_date)
			.toBe("2026-10-18");

		const timedHome = annual({ recurrence: TIMED_RULE, scheduled: "2026-10-18T09:00" });
		expect(update(timedHome, { scheduled: "2026-10-18T10:30" }).recurrence_original_date)
			.toBeUndefined();
	});

	it("does not guess an identity for a legacy off-pattern schedule", () => {
		const result = update(annual({ scheduled: "2026-10-12" }), { scheduled: "2026-10-14" });

		expect(result.recurrence_original_date).toBeUndefined();
	});

	it("keeps the Google exception path and does not add the native marker", () => {
		const result = update(annual({ googleCalendarEventId: "master-event-id" }), {
			scheduled: "2026-10-12",
		});

		expect(result.googleCalendarExceptionOriginalScheduled).toBe("2026-10-18");
		expect(result.recurrence_original_date).toBeUndefined();
	});

	it.each([
		["rule", { recurrence: "DTSTART:20261018;FREQ=MONTHLY" }],
		["anchor", { recurrence_anchor: "completion" as const }],
	])("clears the marker on an explicit %s edit", (_label, updates) => {
		const result = update(moved(), updates);

		expect(Object.prototype.hasOwnProperty.call(result, "recurrence_original_date")).toBe(true);
		expect(result.recurrence_original_date).toBeUndefined();
	});

	it("keeps the marker when the rule is re-saved unchanged", () => {
		const result = update(moved(), { recurrence: RULE });

		expect(result.recurrence_original_date).toBe("2026-10-18");
	});

	it.each(["complete_instances", "skipped_instances"] as const)(
		"clears the marker when a materialized parent advances automatically (%s)",
		(field) => {
			// Completing/skipping the materialized note records the original date on
			// the parent and moves the parent's cursor to the next occurrence.
			const result = update(moved(), { scheduled: "2027-10-18", [field]: ["2026-10-18"] });

			expect(Object.prototype.hasOwnProperty.call(result, "recurrence_original_date")).toBe(true);
			expect(result.recurrence_original_date).toBeUndefined();
			expect(result.googleCalendarExceptionOriginalScheduled).toBeUndefined();
		}
	);

	describe.each([
		["a pending moved occurrence", moved()],
		["an unmarked DTSTART-less series", annual({ recurrence: "FREQ=YEARLY" })],
		["a marked DTSTART-less series", moved({ recurrence: "FREQ=YEARLY" })],
	] as const)("bulk rule and schedule edits from %s", (_label, original) => {
		it.each([
			["a new anchored rule", "DTSTART:20261104;FREQ=WEEKLY;BYDAY=WE", "DTSTART:20261104;FREQ=WEEKLY;BYDAY=WE"],
			["a new DTSTART-less rule", "FREQ=WEEKLY;BYDAY=WE", "DTSTART:20261104;FREQ=WEEKLY;BYDAY=WE"],
			["a removed rule", undefined, undefined],
		] as const)("keeps %s instead of restoring the old rule or anchor", (_change, recurrence, expectedRule) => {
			const updates = { recurrence, scheduled: "2026-11-04" };
			const recurrenceUpdates = update(original, updates);
			const updated = { ...original, ...updates, ...recurrenceUpdates };

			expect(updated.recurrence).toBe(expectedRule);
			expect(updated.scheduled).toBe("2026-11-04");
			expect(updated.recurrence_original_date).toBeUndefined();

			// Check the real patch merger as well: an explicit undefined rule must
			// delete the old YAML value, not just omit it from the returned patch.
			const fieldMapper = new FieldMapper({ ...DEFAULT_FIELD_MAPPING, recurrenceOriginalDate: "moved_from" });
			const frontmatter = fieldMapper.mapToFrontmatter(original);
			applyTaskUpdateFrontmatterChange({
				frontmatter,
				originalTask: original,
				updates,
				recurrenceUpdates,
				dateModified: "2026-10-12T08:00:00.000Z",
				fieldMapper,
				taskIdentification: { method: "tag", tag: "task", propertyName: "", propertyValue: "" },
				storeTitleInFilename: false,
				updateCompletedDateInFrontmatter: jest.fn(),
			});
			expect(frontmatter.scheduled).toBe("2026-11-04");
			expect(frontmatter).not.toHaveProperty("moved_from");
			if (expectedRule === undefined) {
				expect(frontmatter).not.toHaveProperty("recurrence");
			} else {
				expect(frontmatter.recurrence).toBe(expectedRule);
			}
		});
	});

	it("treats a manual reschedule next to history edits as a move, not an advance", () => {
		const result = update(annual(), {
			scheduled: "2026-10-12",
			complete_instances: ["2025-10-18"],
		});

		expect(result.recurrence_original_date).toBe("2026-10-18");
	});
});

describe("issue #2396 calendar placement", () => {
	function createPlugin(): TaskNotesPlugin {
		return {
			priorityManager: {
				getPriorityConfig: jest.fn().mockReturnValue({ color: "#3366ff" }),
			},
		} as unknown as TaskNotesPlugin;
	}

	function render(
		task: TaskInfo,
		from: string,
		to: string,
		options: Parameters<typeof generateRecurringTaskInstances>[4] = {}
	): CalendarEvent[] {
		return generateRecurringTaskInstances(task, day(from), day(to), createPlugin(), options);
	}

	// [start, instanceDate] per event, sorted for stable comparison.
	const placements = (events: CalendarEvent[]) =>
		events.map((event) => [event.start, event.extendedProps.instanceDate]).sort();

	it("shows a moved occurrence once, at its new placement with the original identity", () => {
		const events = render(moved(), "2026-10-11", "2026-10-20");

		expect(placements(events)).toEqual([["2026-10-12", "2026-10-18"]]);
		expect(events[0].extendedProps.isNextScheduledOccurrence).toBe(true);
		expect(events[0].id).toBe(`next-scheduled-${PATH}-2026-10-18`);
	});

	it("keeps the next year's rule occurrence after the move", () => {
		const events = render(moved(), "2027-10-11", "2027-10-20");

		expect(placements(events).filter(([start]) => String(start).startsWith("2027"))).toEqual([
			["2027-10-18", "2027-10-18"],
		]);
	});

	it("still shows both placements for a legacy off-pattern schedule without a marker", () => {
		const events = render(annual({ scheduled: "2026-10-12" }), "2026-10-11", "2026-10-20");

		expect(placements(events)).toEqual([
			["2026-10-12", "2026-10-12"],
			["2026-10-18", "2026-10-18"],
		]);
	});

	it("suppresses the original date but keeps a later real occurrence the move landed on", () => {
		const events = render(movedOntoRuleDate(), "2026-10-11", "2026-10-28");

		expect(placements(events)).toEqual([
			["2026-10-19", "2026-10-12"],
			["2026-10-19", "2026-10-19"],
			["2026-10-26", "2026-10-26"],
		]);
	});

	it("keeps the original identity and clock time for timed moves", () => {
		const events = render(
			annual({ recurrence: TIMED_RULE, scheduled: "2026-10-12T14:30", recurrence_original_date: "2026-10-18" }),
			"2026-10-11",
			"2026-10-20"
		);

		expect(events).toHaveLength(1);
		expect(String(events[0].start)).toMatch(/^2026-10-12T14:30/);
		expect(events[0].extendedProps.instanceDate).toBe("2026-10-18");
	});

	it("does not resurrect a completed moved occurrence at its original date", () => {
		const completedMoved = moved({
			recurrence: "DTSTART:20261018;FREQ=DAILY;COUNT=1",
			complete_instances: ["2026-10-18"],
		});

		const shown = render(completedMoved, "2026-10-11", "2026-10-20");
		expect(placements(shown)).toEqual([["2026-10-12", "2026-10-18"]]);
		expect(shown[0].extendedProps.isCompleted).toBe(true);

		expect(
			render(completedMoved, "2026-10-11", "2026-10-20", { showCompletedRecurringInstances: false })
		).toEqual([]);
	});

	it("hides a skipped moved occurrence when skipped instances are hidden", () => {
		const skippedMoved = moved({
			recurrence: "DTSTART:20261018;FREQ=DAILY;COUNT=1",
			skipped_instances: ["2026-10-18"],
		});

		expect(
			render(skippedMoved, "2026-10-11", "2026-10-20", { showSkippedRecurringInstances: false })
		).toEqual([]);
	});

	it("does not also show the parent once the original occurrence is materialized", () => {
		const events = render(moved(), "2026-10-11", "2026-10-20", {
			materializedOccurrenceDates: ["2026-10-18"],
		});

		expect(events).toEqual([]);
	});

	it("leaves the Google moved-exception placement unchanged", () => {
		const google = annual({
			scheduled: "2026-10-12",
			googleCalendarEventId: "master-event-id",
			googleCalendarExceptionOriginalScheduled: "2026-10-18",
		});

		expect(placements(render(google, "2026-10-11", "2026-10-20"))).toEqual([
			["2026-10-12", "2026-10-12"],
		]);
	});
});

describe("issue #2396 materializing a moved occurrence", () => {
	function harness(parent: TaskInfo, existingOccurrences: TaskInfo[] = []) {
		const plugin = PluginFactory.createMockPlugin({
			cacheManager: {
				getTaskInfo: jest.fn(async (path: string) =>
					path === parent.path ? parent : existingOccurrences.find((task) => task.path === path)
				),
				getAllTasks: jest.fn(async () => [parent, ...existingOccurrences]),
			},
		});
		plugin.settings.defaultTaskStatus = "open";
		plugin.settings.defaultTaskPriority = "normal";
		plugin.settings.useFrontmatterMarkdownLinks = false;
		plugin.app.vault.getAbstractFileByPath = jest.fn((path: string) => new TFile(path));
		plugin.app.metadataCache.fileToLinktext = jest.fn((file: { path: string }) => file.path.replace(/\.md$/i, ""));
		plugin.app.metadataCache.getFirstLinkpathDest = jest.fn();
		const service = new TaskService(plugin);
		const create = jest.spyOn(service, "createTask").mockImplementation(async (data) => {
			const path = `Tasks/Annual ${data.occurrence_date}.md`;
			return {
				file: new TFile(path),
				taskInfo: { ...data, path, archived: false } as TaskInfo,
			};
		});
		return { service, create };
	}

	it("keeps the moved placement while recording the original occurrence date", async () => {
		const parent = moved({ due: "2026-10-14" });
		const { service, create } = harness(parent);

		await service.materializeOccurrence(parent, "2026-10-18");

		const data = create.mock.calls[0][0];
		expect(data).toMatchObject({
			scheduled: "2026-10-12",
			due: "2026-10-14",
			occurrence_date: "2026-10-18",
		});
		expect(data).not.toHaveProperty("recurrence_original_date");
	});

	it.each([
		["a date string", "2026-10-12"],
		["a Date", day("2026-10-12")],
	] as const)("normalizes a moved execution date supplied as %s before creating its child", async (_label, target) => {
		const parent = moved({ due: "2026-10-14" });
		const { service, create } = harness(parent);

		const occurrence = await service.materializeOccurrence(parent, target);

		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0]).toMatchObject({
			scheduled: "2026-10-12",
			due: "2026-10-14",
			occurrence_date: "2026-10-18",
		});
		expect(occurrence.occurrence_date).toBe("2026-10-18");
		expect(occurrence).not.toHaveProperty("recurrence_original_date");
	});

	it("looks up the original child when materializing the moved execution date again", async () => {
		const parent = moved();
		const existing = annual({
			path: "Tasks/Annual 2026-10-18.md",
			recurrence: undefined,
			recurrence_parent: "[[Tasks/Annual]]",
			occurrence_date: "2026-10-18",
			scheduled: "2026-10-12",
		});
		const { service, create } = harness(parent, [existing]);

		await expect(service.materializeOccurrence(parent, "2026-10-12")).resolves.toBe(existing);
		await expect(service.findMaterializedOccurrence(parent, "2026-10-12")).resolves.toBe(existing);
		expect(create).not.toHaveBeenCalled();
	});

	it("coalesces concurrent execution-date and original-date materialization requests", async () => {
		const parent = moved();
		const { service, create } = harness(parent);

		const [execution, original, executionAsDate] = await Promise.all([
			service.materializeOccurrence(parent, "2026-10-12"),
			service.materializeOccurrence(parent, "2026-10-18"),
			service.materializeOccurrence(parent, day("2026-10-12")),
		]);

		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0]).toMatchObject({
			scheduled: "2026-10-12",
			occurrence_date: "2026-10-18",
		});
		expect(execution).toBe(original);
		expect(executionAsDate).toBe(original);
	});

	it("materializes an explicit on-pattern landing date as its own child, not the moved original's child", async () => {
		const parent = movedOntoRuleDate();
		const { service, create } = harness(parent);

		const [original, landing] = await Promise.all([
			service.materializeOccurrence(parent, "2026-10-12"),
			service.materializeOccurrence(parent, "2026-10-19"),
		]);

		expect(create).toHaveBeenCalledTimes(2);
		expect(create.mock.calls.map(([data]) => [data.scheduled, data.occurrence_date]).sort()).toEqual([
			["2026-10-19", "2026-10-12"],
			["2026-10-19", "2026-10-19"],
		]);
		expect(original.occurrence_date).toBe("2026-10-12");
		expect(landing.occurrence_date).toBe("2026-10-19");
		expect(landing.path).not.toBe(original.path);
		expect(original).not.toHaveProperty("recurrence_original_date");
		expect(landing).not.toHaveProperty("recurrence_original_date");
	});

	it("keeps the clock time of a timed moved placement", async () => {
		const parent = annual({
			recurrence: TIMED_RULE,
			scheduled: "2026-10-12T14:30",
			recurrence_original_date: "2026-10-18",
		});
		const { service, create } = harness(parent);

		await service.materializeOccurrence(parent, "2026-10-18");

		expect(create.mock.calls[0][0]).toMatchObject({
			scheduled: "2026-10-12T14:30",
			occurrence_date: "2026-10-18",
		});
	});

	it("lets explicit overrides win and leaves other occurrences at their own dates", async () => {
		const parent = moved();
		const { service, create } = harness(parent);

		await service.materializeOccurrence(parent, "2026-10-18", { scheduled: "2026-10-13" });
		await service.materializeOccurrence(parent, "2027-10-18");

		expect(create.mock.calls[0][0]).toMatchObject({
			scheduled: "2026-10-13",
			occurrence_date: "2026-10-18",
		});
		expect(create.mock.calls[1][0]).toMatchObject({
			scheduled: "2027-10-18",
			occurrence_date: "2027-10-18",
		});
	});
});

describe("issue #2396 materialized parent marker persistence", () => {
	const mapping = {
		...DEFAULT_FIELD_MAPPING,
		recurrenceOriginalDate: "moved_from",
		scheduled: "planned_on",
		completeInstances: "completed_on",
		skippedInstances: "skipped_on",
	};

	function harness(parent: TaskInfo, occurrenceDate: string) {
		const fieldMapper = new FieldMapper(mapping);
		const occurrence: TaskInfo = {
			title: "Annual occurrence",
			status: "open",
			priority: "normal",
			archived: false,
			path: `Tasks/Annual ${occurrenceDate}.md`,
			recurrence_parent: "[[Tasks/Annual]]",
			occurrence_date: occurrenceDate,
			scheduled: parent.scheduled,
			due: parent.due,
		};
		const tasks = new Map<string, TaskInfo>([[parent.path, parent], [occurrence.path, occurrence]]);
		const files = new Map<string, TFile>([...tasks.keys()].map((path) => [path, new TFile(path)]));
		const render = (frontmatter: Record<string, unknown>) =>
			`---\n${stringifyYaml(frontmatter)}---\nOccurrence content\n`;
		const contents = new Map<string, string>([...tasks].map(([path, task]) => [
			path,
			render(fieldMapper.mapToFrontmatter(task)),
		]));
		const frontmatter = (path = parent.path) => readCompletionContent(contents.get(path)!).frontmatter;
		const updateCache = jest.fn((path: string, task: TaskInfo) => {
			tasks.set(path, task);
		});
		const plugin = PluginFactory.createMockPlugin({
			fieldMapper,
			cacheManager: {
				getTaskInfo: jest.fn(async (path: string) => tasks.get(path) ?? null),
				getAllTasks: jest.fn(async () => [...tasks.values()]),
				updateTaskInfoInCache: updateCache,
				getBlockedTaskPaths: jest.fn(() => []),
			},
		});
		plugin.settings.fieldMapping = mapping;
		plugin.settings.maintainDueDateOffsetInRecurring = false;
		plugin.settings.useFrontmatterMarkdownLinks = false;
		plugin.app.vault.getAbstractFileByPath = jest.fn((path: string) => files.get(path) ?? null);
		plugin.app.vault.read = jest.fn(async (file: TFile) => contents.get(file.path)!);
		plugin.app.metadataCache.fileToLinktext = jest.fn((file: TFile) => file.path.replace(/\.md$/i, ""));
		plugin.app.metadataCache.getFirstLinkpathDest = jest.fn();
		plugin.app.fileManager.processFrontMatter = jest.fn(
			async (file: TFile, change: (value: Record<string, unknown>) => void) => {
				const value = frontmatter(file.path);
				change(value);
				contents.set(file.path, render(value));
			}
		);
		const service = new TaskService(plugin);
		plugin.taskService = service;
		return { service, occurrence, frontmatter, updateCache, cached: () => tasks.get(parent.path)! };
	}

	describe.each([
		{
			label: "an off-pattern moved original",
			parent: moved({ occurrence_materialization: "manual" }),
			occurrenceDate: "2026-10-18",
			expectedScheduled: "2027-10-18",
			expectedMarker: undefined,
		},
		{
			label: "a moved original whose next occurrence shares its placement date",
			parent: { ...movedOntoRuleDate(), occurrence_materialization: "manual" as const },
			occurrenceDate: "2026-10-12",
			expectedScheduled: "2026-10-19",
			expectedMarker: undefined,
		},
		{
			label: "the distinct real pattern occurrence at the pending move's placement",
			parent: { ...movedOntoRuleDate(), occurrence_materialization: "manual" as const },
			occurrenceDate: "2026-10-19",
			expectedScheduled: "2026-10-19",
			expectedMarker: "2026-10-12",
		},
	])("$label", ({ parent, occurrenceDate, expectedScheduled, expectedMarker }) => {
		it.each(["complete", "skip"] as const)(
			"persists %s through the public API with the mapped marker and cache in agreement",
			async (action) => {
				const { service, occurrence, frontmatter, updateCache, cached } = harness(parent, occurrenceDate);
				expect(frontmatter().moved_from).toBe(parent.recurrence_original_date);

				const updatedOccurrence = action === "complete"
					? await service.toggleRecurringTaskCompleteWithOccurrenceNotes(parent, day(occurrenceDate))
					: await service.skipMaterializedOccurrence(occurrence, "skipped");

				expect(updatedOccurrence.path).toBe(occurrence.path);
				expect(updatedOccurrence.status).toBe(action === "complete" ? "done" : "skipped");
				const persisted = frontmatter();
				expect(persisted.planned_on).toBe(expectedScheduled);
				expect(persisted.recurrence).toBe(parent.recurrence);
				expect(persisted[action === "complete" ? "completed_on" : "skipped_on"]).toEqual([occurrenceDate]);
				expect(persisted).not.toHaveProperty("recurrence_original_date");
				if (expectedMarker === undefined) {
					// Start with an actual YAML marker so merely updating the cache cannot pass.
					expect(persisted).not.toHaveProperty("moved_from");
				} else {
					expect(persisted.moved_from).toBe(expectedMarker);
				}
				expect(cached().scheduled).toBe(expectedScheduled);
				expect(cached().recurrence_original_date).toBe(expectedMarker);
				expect(cached().complete_instances).toEqual(action === "complete" ? [occurrenceDate] : []);
				expect(cached().skipped_instances).toEqual(action === "skip" ? [occurrenceDate] : []);
				expect(updateCache).toHaveBeenCalledWith(parent.path, expect.objectContaining({
					scheduled: expectedScheduled,
					recurrence_original_date: expectedMarker,
				}));
			}
		);
	});
});

describe("issue #2396 Undo", () => {
	beforeAll(() => {
		globalThis.structuredClone = (value) => deserialize(serialize(value));
	});

	const movedBefore = `---
scheduled: 2026-10-12
due: 2026-10-14
recurrence: 'DTSTART:20261018;FREQ=YEARLY'
recurrence_original_date: 2026-10-18
complete_instances: []
dateModified: old
---
- [ ] Review
`;
	const advancedAfter = `---
scheduled: 2027-10-18
due: 2027-10-20
recurrence: 'DTSTART:20261018;FREQ=YEARLY'
complete_instances: ['2026-10-18']
dateModified: new
---
- [ ] Review
`;
	const properties = [
		"scheduled",
		"due",
		"recurrence",
		"recurrence_original_date",
		"complete_instances",
	];
	const receipt = () =>
		buildCompletionContentUndo(movedBefore, advancedAfter, properties, "dateModified");

	it("restores the moved placement and its original-date marker", () => {
		const restored = restoreCompletionContent(advancedAfter, receipt(), "dateModified", "undo-time");

		expect(restored).not.toBeNull();
		expect(readCompletionContent(restored!).frontmatter).toEqual({
			...readCompletionContent(movedBefore).frontmatter,
			dateModified: "undo-time",
		});
	});

	it("refuses to overwrite a marker added after the completion", () => {
		const lateMove = advancedAfter.replace(
			"dateModified: new",
			"recurrence_original_date: 2027-01-01\ndateModified: new"
		);

		expect(restoreCompletionContent(lateMove, receipt(), "dateModified", "undo-time")).toBeNull();
	});

	it("does not add a marker when none existed before the completion", () => {
		const plainBefore = movedBefore.replace("recurrence_original_date: 2026-10-18\n", "");
		const undo = buildCompletionContentUndo(plainBefore, advancedAfter, properties, "dateModified");
		const restored = restoreCompletionContent(advancedAfter, undo, "dateModified", "undo-time");

		expect(readCompletionContent(restored!).frontmatter).not.toHaveProperty("recurrence_original_date");
	});

	describe.each([
		["the default property", "recurrence_original_date"],
		["a custom property", "moved_from"],
	])("completeRecurringTaskWithUndo with %s", (_label, markerField) => {
		function createHarness() {
			const fieldMapper = new FieldMapper({ ...DEFAULT_FIELD_MAPPING, recurrenceOriginalDate: markerField });
			const mapped = (key: Parameters<FieldMapper["toUserField"]>[0]) => fieldMapper.toUserField(key);
			const render = (frontmatter: Record<string, unknown>) =>
				`---\n${stringifyYaml(frontmatter)}---\n- [ ] Review\n`;
			const file = new TFile(PATH);
			let content = render({
				[mapped("status")]: "open",
				[mapped("scheduled")]: "2026-10-12",
				[mapped("recurrence")]: RULE,
				[markerField]: "2026-10-18",
				[mapped("completeInstances")]: [],
				[mapped("skippedInstances")]: [],
				[mapped("dateModified")]: "old",
			});
			const parent = {
				...fieldMapper.mapFromFrontmatter(readCompletionContent(content).frontmatter, PATH),
				title: "Annual",
				path: PATH,
				archived: false,
			} as TaskInfo;
			let cached: TaskInfo = parent;

			const plugin = {
				app: {
					vault: {
						getAbstractFileByPath: jest.fn(() => file),
						read: jest.fn(async () => content),
						process: jest.fn(async (_file: unknown, change: (current: string) => string) => {
							content = change(content);
							return content;
						}),
					},
				},
				cacheManager: {
					getTaskInfo: jest.fn(async () => cached),
					updateTaskInfoInCache: jest.fn(),
				},
				taskService: {
					findMaterializedOccurrence: jest.fn(async () => undefined),
					toggleRecurringTaskCompleteWithOccurrenceNotes: jest.fn(
						async (
							original: TaskInfo,
							date: Date,
							onTransition?: (before: TaskInfo, after: TaskInfo) => void
						) => {
							const plan = buildRecurringTaskCompletePlan({
								freshTask: original,
								targetDate: date,
								currentTimestamp: "now",
								maintainDueDateOffsetInRecurring: false,
							});
							const frontmatter = readCompletionContent(content).frontmatter;
							applyRecurringTaskCompleteFrontmatterChange({
								frontmatter,
								completeInstancesField: mapped("completeInstances"),
								skippedInstancesField: mapped("skippedInstances"),
								dateModifiedField: mapped("dateModified"),
								scheduledField: mapped("scheduled"),
								dueField: mapped("due"),
								recurrenceField: mapped("recurrence"),
								recurrenceOriginalDateField: mapped("recurrenceOriginalDate"),
								googleCalendarExceptionOriginalScheduledField: mapped(
									"googleCalendarExceptionOriginalScheduled"
								),
								googleCalendarMovedOriginalDatesField: mapped("googleCalendarMovedOriginalDates"),
								plan,
							});
							content = render(frontmatter);
							cached = plan.updatedTask;
							onTransition?.(original, plan.updatedTask);
							return plan.updatedTask;
						}
					),
				},
				fieldMapper,
				settings: { resetCheckboxesOnRecurrence: false },
				statusManager: { isCompletedStatus: jest.fn() },
				emitter: { trigger: jest.fn() },
			} as unknown as TaskNotesPlugin;

			return {
				plugin,
				parent,
				frontmatter: () => readCompletionContent(content).frontmatter,
				edit: (change: (frontmatter: Record<string, unknown>) => void) => {
					const frontmatter = readCompletionContent(content).frontmatter;
					change(frontmatter);
					content = render(frontmatter);
				},
				cache: () => plugin.cacheManager.updateTaskInfoInCache as jest.Mock,
			};
		}

		it("completes the original occurrence and Undo restores the moved placement and marker", async () => {
			const harness = createHarness();

			const result = await completeRecurringTaskWithUndo(
				harness.plugin,
				harness.parent,
				getRecurringTaskActionDate(harness.parent)
			);

			expect(result.completed).toBe(true);
			expect(harness.frontmatter()).toMatchObject({
				scheduled: "2027-10-18",
				complete_instances: ["2026-10-18"],
			});
			expect(harness.frontmatter()).not.toHaveProperty(markerField);

			await expect(result.undo()).resolves.toBe(true);

			expect(harness.frontmatter()).toMatchObject({
				scheduled: "2026-10-12",
				complete_instances: [],
				[markerField]: "2026-10-18",
			});
			expect(harness.cache()).toHaveBeenCalledWith(
				PATH,
				expect.objectContaining({
					scheduled: "2026-10-12",
					recurrence_original_date: "2026-10-18",
				})
			);
		});

		it("refuses Undo when the marker was edited after the completion", async () => {
			const harness = createHarness();
			const result = await completeRecurringTaskWithUndo(
				harness.plugin,
				harness.parent,
				getRecurringTaskActionDate(harness.parent)
			);
			harness.edit((frontmatter) => {
				frontmatter[markerField] = "2027-01-01";
			});

			await expect(result.undo()).resolves.toBe(false);

			expect(harness.frontmatter()).toMatchObject({
				scheduled: "2027-10-18",
				complete_instances: ["2026-10-18"],
				[markerField]: "2027-01-01",
			});
		});
	});
});

describe("issue #2396 default list and board identity", () => {
	const plugin = {
		settings: { showCompletedTaskStrikethrough: true, subtaskChevronPosition: "right" },
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
		getActiveTimeSession: jest.fn(() => null),
		app: { metadataCache: { getCache: jest.fn(() => null) } },
	} as unknown as TaskNotesPlugin;

	// What the list and board views pass: the landing day as "today", plus the opt-in flag.
	const defaultControls = (targetDate: Date) => ({ targetDate, usePendingOccurrenceIdentity: true });
	const exhausted = (overrides: Partial<TaskInfo>) =>
		moved({ recurrence: "DTSTART:20261018;FREQ=DAILY;COUNT=1", ...overrides });

	describe("action date", () => {
		it("targets the pending original, not the landing date, for the Kanban default controls", () => {
			const collision = movedOntoRuleDate();

			expect(getKanbanTaskActionDate(collision)).toEqual(day("2026-10-12"));
			expect(getKanbanTaskActionDate(moved({ due: "2026-10-14" }))).toEqual(day("2026-10-18"));
			expect(complete(collision, getKanbanTaskActionDate(collision)).dateStr).toBe("2026-10-12");
			expect(skip(collision, getKanbanTaskActionDate(collision)).dateStr).toBe("2026-10-12");
		});

		it("keeps the scheduled-or-due fallback for unmarked, completion-anchored and non-recurring tasks", () => {
			expect(
				getKanbanTaskActionDate(annual({ recurrence: WEEKLY_RULE, scheduled: "2026-10-19" }))
			).toEqual(day("2026-10-19"));
			expect(
				getKanbanTaskActionDate(
					annual({ scheduled: undefined, due: "2026-10-21", recurrence: WEEKLY_RULE })
				)
			).toEqual(day("2026-10-21"));
			// A stray marker is not an identity for these tasks.
			expect(getKanbanTaskActionDate(moved({ recurrence_anchor: "completion" }))).toEqual(
				day("2026-10-12")
			);
			expect(
				getKanbanTaskActionDate(moved({ recurrence: undefined, recurrence_anchor: undefined }))
			).toEqual(day("2026-10-12"));
		});
	});

	describe("card render state", () => {
		it("defaults the target date to the pending original while the marker exists", () => {
			expect(getDefaultTaskCardTargetDate(moved())).toEqual(day("2026-10-18"));
			expect(getDefaultTaskCardTargetDate(movedOntoRuleDate())).toEqual(day("2026-10-12"));
			expect(getDefaultTaskCardTargetDate(annual({ scheduled: "2026-10-12" }))).toEqual(
				day("2026-10-12")
			);
		});

		it.each([
			["default options", {}],
			["list/board controls", defaultControls(day("2026-10-12"))],
		])("shows an exhausted completed moved occurrence as completed with %s", (_name, options) => {
			const state = buildTaskCardRenderState(
				exhausted({ complete_instances: ["2026-10-18"] }),
				plugin,
				options
			);

			expect(state.targetDate).toEqual(day("2026-10-18"));
			expect(state.isCompleted).toBe(true);
			expect(state.isSkipped).toBe(false);
			expect(state.cardClasses).toContain("task-card--completed");
		});

		it.each([
			["default options", {}],
			["list/board controls", defaultControls(day("2026-10-12"))],
		])("shows an exhausted skipped moved occurrence as skipped with %s", (_name, options) => {
			const state = buildTaskCardRenderState(
				exhausted({ skipped_instances: ["2026-10-18"] }),
				plugin,
				options
			);

			expect(state.targetDate).toEqual(day("2026-10-18"));
			expect(state.isSkipped).toBe(true);
			expect(state.isCompleted).toBe(false);
		});

		it("keeps an explicit projected date distinct from the pending original", () => {
			const done = exhausted({ complete_instances: ["2026-10-18"] });

			// Calendar-style card for the landing placement: no opt-in flag.
			const projected = buildTaskCardRenderState(done, plugin, { targetDate: day("2026-10-12") });
			expect(projected.targetDate).toEqual(day("2026-10-12"));
			expect(projected.isCompleted).toBe(false);

			// The same explicit date is overridden only when the view opts in.
			const pending = buildTaskCardRenderState(done, plugin, defaultControls(day("2026-10-12")));
			expect(pending.targetDate).toEqual(day("2026-10-18"));
			expect(pending.isCompleted).toBe(true);
		});

		it("keeps a real occurrence on the landing date distinct from the moved original", () => {
			// Monday 12 Oct moved onto Monday 19 Oct, where the rule has its own occurrence.
			const collision = (instances: string[]) => ({
				...movedOntoRuleDate(),
				complete_instances: instances,
			});

			const originalDone = collision(["2026-10-12"]);
			expect(
				buildTaskCardRenderState(originalDone, plugin, defaultControls(day("2026-10-19")))
					.isCompleted
			).toBe(true);
			expect(
				buildTaskCardRenderState(originalDone, plugin, { targetDate: day("2026-10-19") })
					.isCompleted
			).toBe(false);

			const landingDone = collision(["2026-10-19"]);
			expect(
				buildTaskCardRenderState(landingDone, plugin, defaultControls(day("2026-10-19")))
					.isCompleted
			).toBe(false);
			expect(
				buildTaskCardRenderState(landingDone, plugin, { targetDate: day("2026-10-19") })
					.isCompleted
			).toBe(true);
		});

		it("continues targeting the next scheduled occurrence after the marker is consumed", () => {
			const advanced = complete(movedOntoRuleDate()).updatedTask;
			expect(advanced.recurrence_original_date).toBeUndefined();
			const state = buildTaskCardRenderState(advanced, plugin, defaultControls(day("2026-10-12")));

			expect(state.targetDate).toEqual(day("2026-10-19"));
			expect(state.isCompleted).toBe(false);
			const next = complete(advanced, state.targetDate);
			expect(next.updatedTask.complete_instances).toEqual(["2026-10-12", "2026-10-19"]);
			expect(next.updatedTask.scheduled).toBe("2026-10-26");
		});
	});
});

describe("issue #2396 due span of a moved occurrence", () => {
	const plan = (
		action: "complete" | "skip",
		task: TaskInfo,
		target: Date = getRecurringTaskActionDate(task)
	) =>
		(action === "complete" ? buildRecurringTaskCompletePlan : buildRecurringTaskSkippedPlan)({
			freshTask: task,
			targetDate: target,
			currentTimestamp: "2026-10-12T08:00:00.000Z",
			maintainDueDateOffsetInRecurring: true,
		});

	// Moved span 12 -> 14 October (two days) of the 18 October occurrence.
	const spanned = (overrides: Partial<TaskInfo> = {}) => moved({ due: "2026-10-14", ...overrides });

	it.each(["complete", "skip"] as const)(
		"%s keeps the moved span and applies its two-day offset to the next occurrence",
		(action) => {
			const result = plan(action, spanned());

			expect(result.dateStr).toBe("2026-10-18");
			expect(result.updatedTask.scheduled).toBe("2027-10-18");
			expect(result.updatedTask.due).toBe("2027-10-20");
			expect(result.updatedTask.recurrence_original_date).toBeUndefined();
		}
	);

	it.each(["complete", "skip"] as const)(
		"%s from the moved placement date resolves to the same span and original",
		(action) => {
			const result = plan(action, spanned(), day("2026-10-12"));

			expect(result.dateStr).toBe("2026-10-18");
			expect(result.updatedTask.scheduled).toBe("2027-10-18");
			expect(result.updatedTask.due).toBe("2027-10-20");
		}
	);

	it.each(["complete", "skip"] as const)("%s preserves the timed components of both endpoints", (action) => {
		const result = plan(
			action,
			spanned({
				recurrence: TIMED_RULE,
				scheduled: "2026-10-12T09:00",
				due: "2026-10-14T17:00",
			})
		);

		expect(result.dateStr).toBe("2026-10-18");
		expect(result.updatedTask.scheduled).toBe("2027-10-18T09:00");
		expect(result.updatedTask.due).toBe("2027-10-20T17:00");
		expect(result.updatedTask.recurrence_original_date).toBeUndefined();
	});

	it.each(["complete", "skip"] as const)(
		"%s of a span moved onto a real rule date measures the offset from the moved placement",
		(action) => {
			// Monday 12 Oct moved to Monday 19 Oct with due on 21 Oct (two days).
			const result = plan(action, { ...movedOntoRuleDate(), due: "2026-10-21" });

			expect(result.dateStr).toBe("2026-10-12");
			expect(result.updatedTask.scheduled).toBe("2026-10-19");
			expect(result.updatedTask.due).toBe("2026-10-21");
			expect(result.updatedTask.recurrence_original_date).toBeUndefined();
		}
	);

	it.each(["complete", "skip"] as const)(
		"%s leaves both endpoints and the marker alone when the series is exhausted",
		(action) => {
			const result = plan(action, spanned({ recurrence: "DTSTART:20261018;FREQ=DAILY;COUNT=1" }));

			expect(result.updatedTask.scheduled).toBe("2026-10-12");
			expect(result.updatedTask.due).toBe("2026-10-14");
			expect(result.updatedTask.recurrence_original_date).toBe("2026-10-18");
		}
	);

	it("keeps the existing offset heuristic for an unmarked later shift", () => {
		const result = plan("complete", annual({ scheduled: "2026-10-20", due: "2026-10-22" }));

		expect(result.dateStr).toBe("2026-10-18");
		expect(result.updatedTask.scheduled).toBe("2027-10-18");
		expect(result.updatedTask.due).toBe("2027-10-22");
	});

	describe("calendar span segments", () => {
		const plugin = {
			priorityManager: { getPriorityConfig: jest.fn().mockReturnValue({ color: "#3366ff" }) },
			statusManager: { isCompletedStatus: jest.fn().mockReturnValue(false) },
		} as unknown as TaskNotesPlugin;

		const renderSpan = (task: TaskInfo) =>
			generateRecurringTaskInstances(task, new Date(2026, 9, 11), new Date(2026, 9, 20), plugin, {
				showScheduledToDueSpan: true,
			});

		it("renders an all-day moved span once with the original instance identity", () => {
			const events = renderSpan(spanned());

			expect(events.map((event) => [event.start, event.end])).toEqual([["2026-10-12", "2026-10-15"]]);
			expect(events.every((event) => event.extendedProps.instanceDate === "2026-10-18")).toBe(true);
			expect(events.every((event) => event.extendedProps.isNextScheduledOccurrence)).toBe(true);
			expect(events.every((event) => event.id.includes("2026-10-18"))).toBe(true);
		});

		it("keeps the original instance identity on every timed segment", () => {
			const events = renderSpan(
				spanned({ recurrence: TIMED_RULE, scheduled: "2026-10-12T09:00", due: "2026-10-14T17:00" })
			);

			expect(events.map((event) => String(event.start).slice(0, 10))).toEqual([
				"2026-10-12",
				"2026-10-13",
				"2026-10-14",
			]);
			expect(events.every((event) => event.extendedProps.instanceDate === "2026-10-18")).toBe(true);
			expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
			// The original rule date is not also projected as an extra span.
			expect(events.some((event) => String(event.start).startsWith("2026-10-18"))).toBe(false);
		});
	});
});
