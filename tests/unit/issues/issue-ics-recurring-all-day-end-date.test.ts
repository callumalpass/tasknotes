import { ICSSubscriptionService } from "../../../src/services/ICSSubscriptionService";
import { ICSEvent } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: jest.fn(),
}));

jest.mock("ical.js", () => jest.requireActual("../../../node_modules/ical.js/dist/ical.es5.cjs"));

type TestableICSSubscriptionService = {
	parseICS(icsData: string, subscriptionId: string): ICSEvent[];
};

function makeService(): TestableICSSubscriptionService {
	return new ICSSubscriptionService({
		loadData: jest.fn().mockResolvedValue({ icsSubscriptions: [] }),
		saveData: jest.fn().mockResolvedValue(undefined),
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		app: {
			vault: {
				getAbstractFileByPath: jest.fn(),
				cachedRead: jest.fn(),
				getFiles: jest.fn().mockReturnValue([]),
				on: jest.fn(),
				offref: jest.fn(),
			},
		},
	} as unknown as ConstructorParameters<
		typeof ICSSubscriptionService
	>[0]) as unknown as TestableICSSubscriptionService;
}

describe("ICS recurring all-day event end dates", () => {
	beforeEach(() => {
		jest.spyOn(Date, "now").mockReturnValue(new Date("2026-05-27T12:00:00.000Z").getTime());
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("preserves one-day all-day duration for each recurrence instance", () => {
		const icsData = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//Test//TaskNotes Regression//EN",
			"BEGIN:VEVENT",
			"DTSTART;VALUE=DATE:20260528",
			"DTEND;VALUE=DATE:20260529",
			"RRULE:FREQ=DAILY;COUNT=4",
			"UID:recurring-all-day-single@test",
			"SUMMARY:One-day hold",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");

		const events = makeService().parseICS(icsData, "test-subscription");

		expect(events.map((event) => ({ start: event.start, end: event.end }))).toEqual([
			{ start: "2026-05-28", end: "2026-05-29" },
			{ start: "2026-05-29", end: "2026-05-30" },
			{ start: "2026-05-30", end: "2026-05-31" },
			{ start: "2026-05-31", end: "2026-06-01" },
		]);
		expect(events.every((event) => event.allDay)).toBe(true);
	});

	it("preserves multi-day all-day duration for each recurrence instance", () => {
		const icsData = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//Test//TaskNotes Regression//EN",
			"BEGIN:VEVENT",
			"DTSTART;VALUE=DATE:20260528",
			"DTEND;VALUE=DATE:20260530",
			"RRULE:FREQ=WEEKLY;COUNT=2",
			"UID:recurring-all-day-multiday@test",
			"SUMMARY:Two-day hold",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");

		const events = makeService().parseICS(icsData, "test-subscription");

		expect(events.map((event) => ({ start: event.start, end: event.end }))).toEqual([
			{ start: "2026-05-28", end: "2026-05-30" },
			{ start: "2026-06-04", end: "2026-06-06" },
		]);
	});
});
