import { updateToNextScheduledOccurrence } from "../../../src/core/recurrence";

describe("issue #1759 - recurring due date advances with scheduled date", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(Date.UTC(2026, 3, 1, 12, 0, 0)));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("advances a stale due date when completing a scheduled recurring instance", () => {
		const nextDates = updateToNextScheduledOccurrence(
			{
				title: "Monthly work window",
				recurrence: "DTSTART:20260401;FREQ=MONTHLY",
				scheduled: "2026-04-01",
				due: "2026-04-03",
				complete_instances: ["2026-04-01"],
				skipped_instances: [],
			},
			false
		);

		expect(nextDates).toEqual({
			scheduled: "2026-05-01",
			due: "2026-05-03",
		});
	});

	it("leaves a future static due date alone when offset preservation is disabled", () => {
		const nextDates = updateToNextScheduledOccurrence(
			{
				title: "Recurring task with fixed deadline",
				recurrence: "DTSTART:20260401;FREQ=MONTHLY",
				scheduled: "2026-04-01",
				due: "2026-12-31",
				complete_instances: ["2026-04-01"],
				skipped_instances: [],
			},
			false
		);

		expect(nextDates).toEqual({
			scheduled: "2026-05-01",
			due: null,
		});
	});
});
