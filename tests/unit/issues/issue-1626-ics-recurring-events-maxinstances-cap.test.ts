import { ICSSubscriptionService } from "../../../src/services/ICSSubscriptionService";
import { ICSEvent } from "../../../src/types";

jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: jest.fn(),
}));

jest.mock("ical.js", () =>
	jest.requireActual("../../../node_modules/ical.js/dist/ical.es5.cjs")
);

const REPORTED_ICS = [
	"BEGIN:VCALENDAR",
	"VERSION:2.0",
	"PRODID:-//Test//Test//EN",
	"BEGIN:VTIMEZONE",
	"TZID:Central Standard Time",
	"BEGIN:STANDARD",
	"DTSTART:16010101T020000",
	"TZOFFSETFROM:-0500",
	"TZOFFSETTO:-0600",
	"RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=1SU;BYMONTH=11",
	"END:STANDARD",
	"BEGIN:DAYLIGHT",
	"DTSTART:16010101T020000",
	"TZOFFSETFROM:-0600",
	"TZOFFSETTO:-0500",
	"RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=2SU;BYMONTH=3",
	"END:DAYLIGHT",
	"END:VTIMEZONE",
	"BEGIN:VEVENT",
	"DTSTART;TZID=Central Standard Time:20250218T093000",
	"DTEND;TZID=Central Standard Time:20250218T100000",
	"RRULE:FREQ=WEEKLY;UNTIL=20270218T153000Z;INTERVAL=1;BYDAY=TU,WE,TH;WKST=SU",
	"SUMMARY:Test - Multi-day BYDAY",
	"UID:test-multi-day-byday@test",
	"END:VEVENT",
	"END:VCALENDAR",
].join("\r\n");

describe("Issue #1626: ICS recurring events truncated by maxInstances=100", () => {
	let service: ICSSubscriptionService;

	beforeEach(() => {
		jest
			.spyOn(Date, "now")
			.mockReturnValue(new Date("2025-02-18T12:00:00.000Z").getTime());

		service = new ICSSubscriptionService({
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
		} as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("expands a multi-day weekly subscription beyond the former 100-instance cap", () => {
		const events = (service as any).parseICS(REPORTED_ICS, "test-sub") as ICSEvent[];
		const eventDates = new Set(
			events.map((event) => new Date(event.start).toISOString().slice(0, 10))
		);

		expect(events.length).toBeGreaterThan(150);
		expect(eventDates).toContain("2025-10-07");
		expect(eventDates).toContain("2025-10-08");
		expect(eventDates).toContain("2026-02-17");
	});
});
