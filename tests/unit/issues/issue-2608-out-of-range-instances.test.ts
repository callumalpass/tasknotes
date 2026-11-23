import { resolveRecurringInstanceDate } from "../../../src/services/task-service/taskRecurringPlanning";
import type { TaskInfo } from "../../../src/types";
import { getTodayString } from "../../../src/utils/dateUtils";

// COUNT and UNTIL bounds need the real rule engine, not the shared rrule mock.
jest.unmock("rrule");
jest.mock("rrule", () => jest.requireActual("../../../node_modules/rrule/dist/es5/rrule.js"));
jest.mock("../../../src/utils/dateUtils", () => ({
	...jest.requireActual("../../../src/utils/dateUtils"),
	getTodayString: jest.fn(),
}));

const mockGetTodayString = getTodayString as jest.MockedFunction<typeof getTodayString>;
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);

function endedSeries(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Bounded series",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Bounded series.md",
		archived: false,
		recurrence: "DTSTART:20261104T190000;FREQ=DAILY;COUNT=5",
		scheduled: "2026-11-08",
		complete_instances: ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"],
		skipped_instances: [],
		...overrides,
	} as TaskInfo;
}

describe("Issue #2608: completions outside a bounded series", () => {
	beforeEach(() => {
		mockGetTodayString.mockReturnValue("2026-11-11");
	});

	it("has no instance to record after a COUNT series has ended", () => {
		expect(resolveRecurringInstanceDate(endedSeries(), day("2026-11-11"))).toBeNull();
	});

	it("has no instance to record after an UNTIL series has ended", () => {
		const task = endedSeries({
			recurrence: "DTSTART:20261104;FREQ=DAILY;UNTIL=20261108",
		});
		expect(resolveRecurringInstanceDate(task, day("2026-11-11"))).toBeNull();
	});

	it("still resolves the series' own dates and stray recorded dates, so both can be cleared", () => {
		const task = endedSeries();
		task.complete_instances = [...(task.complete_instances ?? []), "2026-11-12"];

		expect(resolveRecurringInstanceDate(task, day("2026-11-08"))).toBe("2026-11-08");
		expect(resolveRecurringInstanceDate(task, day("2026-11-12"))).toBe("2026-11-12");
	});

	it("maps an off-rule date to an open occurrence while the series is running", () => {
		const task = endedSeries({ complete_instances: ["2026-11-04"] });
		expect(resolveRecurringInstanceDate(task, day("2026-11-11"))).toBe("2026-11-08");
	});

	it("records any date for completion-anchored series", () => {
		const task = endedSeries({ recurrence_anchor: "completion" });
		expect(resolveRecurringInstanceDate(task, day("2026-11-11"))).toBe("2026-11-11");
	});
});
