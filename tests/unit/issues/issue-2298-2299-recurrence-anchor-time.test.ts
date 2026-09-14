import { buildCustomRecurrenceRule, buildRecurrenceOptions, CustomRecurrenceRuleInput } from "../../../src/components/RecurrenceContextMenu";
import { buildRecurringTaskCompletePlan } from "../../../src/services/task-service/taskRecurringPlanning";
import { updateDTSTARTInRecurrenceRule } from "../../../src/core/recurrence";
import type { TaskInfo } from "../../../src/types";

const input: CustomRecurrenceRuleInput = {
	frequency: "DAILY", interval: 1, dtstart: "2026-09-06", dtstartTime: "20:00",
	recurrenceAnchor: "scheduled", byDay: [], byMonthDay: [], byMonth: [],
	bySetPos: undefined, endType: "never", count: undefined, until: "",
};

function complete(recurrence: string, extra: Partial<TaskInfo> = {}, date = "2026-09-07") {
	return buildRecurringTaskCompletePlan({
		freshTask: {
			path: "task.md", title: "Task", status: "open", priority: "normal",
			archived: false, recurrence, recurrence_anchor: "completion", ...extra,
		},
		targetDate: new Date(`${date}T00:00:00Z`),
		currentTimestamp: `${date}T12:00:00Z`, maintainDueDateOffsetInRecurring: true,
	});
}

describe("Recurrence anchor time (#2298, #2299)", () => {
	it("writes a timed custom anchor with Z, preserving seconds and leaving date-only anchors alone", () => {
		expect(buildCustomRecurrenceRule(input)).toBe("DTSTART:20260906T200000Z;FREQ=DAILY");
		expect(buildCustomRecurrenceRule({ ...input, dtstartTime: "20:00:37" })).toBe("DTSTART:20260906T200037Z;FREQ=DAILY");
		expect(buildCustomRecurrenceRule({ ...input, dtstartTime: "" })).toBe("DTSTART:20260906;FREQ=DAILY");
	});

	it.each(["Z", ""])("normalizes a preset anchor without shifting its clock components (%s)", (suffix) => {
		const options = buildRecurrenceOptions({
			currentValue: `DTSTART:20260906T200037${suffix};FREQ=DAILY`,
			scheduledDate: "2026-09-07", translate: (key) => key,
		});
		for (const option of options.filter((option) => option.value)) {
			expect(option.value).toMatch(/^DTSTART:20260907T200037Z;/);
		}
	});

	it.each(["Z", ""])("retains timed anchor components when completing an instance (%s)", (suffix) => {
		const rule = `DTSTART:20260906T200037${suffix};FREQ=DAILY`;
		expect(complete(rule).updatedTask.recurrence).toBe("DTSTART:20260907T200037Z;FREQ=DAILY");
		expect(complete(rule, { scheduled: "2026-09-06T09:30:00" }).updatedTask.recurrence).toBe("DTSTART:20260907T200037Z;FREQ=DAILY");
	});

	it.each(["2026-03-08", "2026-11-01", "2026-10-04", "2026-04-05"])("does not shift the anchor through local DST on %s", (date) => {
		const rule = "DTSTART:20260101T023037Z;FREQ=DAILY";
		expect(complete(rule, {}, date).updatedTask.recurrence).toBe(`DTSTART:${date.replace(/-/g, "")}T023037Z;FREQ=DAILY`);
	});

	it("keeps date-only completion, scheduled-anchor and uncompletion contracts unchanged", () => {
		expect(complete("DTSTART:20260906;FREQ=DAILY").updatedTask.recurrence).toBe("DTSTART:20260907;FREQ=DAILY");
		const rule = "DTSTART:20260906T200000Z;FREQ=DAILY";
		expect(complete(rule, { recurrence_anchor: "scheduled" }).updatedTask.recurrence).toBe(rule);
		expect(complete(rule, { complete_instances: ["2026-09-07"] }).updatedTask.recurrence).toBe(rule);
	});

	it("does not change the explicit anchor-update API's date-only contract", () => {
		expect(updateDTSTARTInRecurrenceRule("DTSTART:20260906T200000Z;FREQ=DAILY", "2026-09-07")).toBe("DTSTART:20260907;FREQ=DAILY");
	});
});
