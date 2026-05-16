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

describe("issue #1738 Outlook ICS timezone aliases", () => {
	beforeEach(() => {
		ICAL.TimezoneService.reset();
	});

	afterEach(() => {
		ICAL.TimezoneService.reset();
	});

	it("uses the Outlook VTIMEZONE when an event references the base Windows timezone name", () => {
		const icsData = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN",
			"BEGIN:VTIMEZONE",
			"TZID:Pacific Standard Time (Mexico)",
			"BEGIN:STANDARD",
			"DTSTART:16011104T020000",
			"RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11",
			"TZOFFSETFROM:-0700",
			"TZOFFSETTO:-0800",
			"END:STANDARD",
			"BEGIN:DAYLIGHT",
			"DTSTART:16010311T020000",
			"RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3",
			"TZOFFSETFROM:-0800",
			"TZOFFSETTO:-0700",
			"END:DAYLIGHT",
			"END:VTIMEZONE",
			"BEGIN:VEVENT",
			"DTSTART;TZID=Pacific Standard Time:20260414T100000",
			"DTEND;TZID=Pacific Standard Time:20260414T110000",
			"UID:outlook-timezone-alias-1738",
			"SUMMARY:Outlook alias event",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");

		const events = makeService().parseICS(icsData, "outlook-sub");

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			title: "Outlook alias event",
			start: "2026-04-14T17:00:00.000Z",
			end: "2026-04-14T18:00:00.000Z",
			allDay: false,
		});
		expect(events[0].start).not.toBe("2026-04-14T10:00:00.000Z");
	});
});
