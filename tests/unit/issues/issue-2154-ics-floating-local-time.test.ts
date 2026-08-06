import { ICSSubscriptionService } from "../../../src/services/ICSSubscriptionService";
import { ICSEvent } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: jest.fn(),
}));

jest.mock("ical.js", () => {
	const actualICAL = jest.requireActual("../../../node_modules/ical.js/dist/ical.es5.cjs");
	return actualICAL;
});

const ICAL = jest.requireMock("ical.js") as typeof import("ical.js");

type TestableICSSubscriptionService = {
	parseICS(icsData: string, subscriptionId: string): ICSEvent[];
};

function makeService(): TestableICSSubscriptionService {
	const mockPlugin = {
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
	};

	return new ICSSubscriptionService(
		mockPlugin as unknown as ConstructorParameters<typeof ICSSubscriptionService>[0]
	) as unknown as TestableICSSubscriptionService;
}

function mockLocalTimeZone(timeZone: string): void {
	jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
		locale: "en-US",
		calendar: "gregory",
		numberingSystem: "latn",
		timeZone,
	} as Intl.ResolvedDateTimeFormatOptions);
}

describe("issue #2154 ICS floating local times", () => {
	beforeEach(() => {
		ICAL.TimezoneService.reset();
	});

	afterEach(() => {
		ICAL.TimezoneService.reset();
		jest.restoreAllMocks();
	});

	it("treats timed values without TZID as local wall time", () => {
		mockLocalTimeZone("Australia/Melbourne");

		const icsData = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//hacksw/handcal//NONSGML v1.0//EN",
			"BEGIN:VEVENT",
			"UID:issue-2154-floating-shift",
			"DTSTART:20260801T094500",
			"DTEND:20260801T184500",
			"SUMMARY:Shift at VIC Eastern Region",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");

		const events = makeService().parseICS(icsData, "humanforce-sub");

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			title: "Shift at VIC Eastern Region",
			start: "2026-07-31T23:45:00.000Z",
			end: "2026-08-01T08:45:00.000Z",
			allDay: false,
		});
		expect(events[0].start).not.toBe("2026-08-01T09:45:00.000Z");
	});

	it("does not reinterpret explicit UTC values as local wall time", () => {
		mockLocalTimeZone("Australia/Melbourne");

		const icsData = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//TaskNotes//Test//EN",
			"BEGIN:VEVENT",
			"UID:issue-2154-utc-event",
			"DTSTART:20260801T094500Z",
			"DTEND:20260801T184500Z",
			"SUMMARY:UTC event",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");

		const events = makeService().parseICS(icsData, "utc-sub");

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			title: "UTC event",
			start: "2026-08-01T09:45:00.000Z",
			end: "2026-08-01T18:45:00.000Z",
			allDay: false,
		});
	});
});
