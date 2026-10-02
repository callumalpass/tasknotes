import { ICSSubscriptionService } from "../../../src/services/ICSSubscriptionService";
import { convertToGoogleRecurrence } from "../../../src/utils/rruleConverter";

jest.unmock("rrule");
jest.mock("rrule", () => jest.requireActual("../../../node_modules/rrule/dist/es5/rrule.js"));
jest.mock("ical.js", () => jest.requireActual("../../../node_modules/ical.js/dist/ical.es5.cjs"));

const feed = (rule: string, extra: string[] = []) => [
	"BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:old",
	"DTSTART:20100101T100000Z", "DTEND:20100101T110000Z", `RRULE:${rule}`,
	...extra, "END:VEVENT", "END:VCALENDAR",
].join("\r\n");

const service = () => new ICSSubscriptionService({ app: { vault: {} } } as any);

describe("bounded real-library recurrence", () => {
	beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-01T00:00:00Z")));
	afterEach(() => jest.restoreAllMocks());

	it("retains current events from a daily series starting in 2010", () => {
		const events = (service() as any).parseICS(feed("FREQ=DAILY"), "sub");
		expect(events.length).toBeGreaterThan(365);
		expect(events.length).toBeLessThan(400);
		expect(events.some((event: any) => event.start.startsWith("2026-01-01"))).toBe(true);
		expect(events.every((event: any) => Date.parse(event.start) >= Date.parse("2025-12-02"))).toBe(true);
	});

	it.each(["FREQ=DAILY;COUNT=20", "FREQ=DAILY;UNTIL=20100201T100000Z"])("respects historical termination: %s", (rule) => {
		expect((service() as any).parseICS(feed(rule), "sub")).toHaveLength(0);
	});

	it("preserves COUNT and EXDATE across fast-forward", () => {
		const count = Math.round((Date.parse("2026-01-03") - Date.parse("2010-01-01")) / 86400000);
		const events = (service() as any).parseICS(feed(`FREQ=DAILY;COUNT=${count}`, ["EXDATE:20260101T100000Z"]), "sub");
		expect(events.some((event: any) => event.start.startsWith("2026-01-01"))).toBe(false);
		expect(events.some((event: any) => event.start.startsWith("2026-01-02"))).toBe(true);
		expect(events.some((event: any) => event.start.startsWith("2026-01-03"))).toBe(false);
	});

	it("validates DATE exports at midnight, retaining the final UNTIL day", () => {
		const result = convertToGoogleRecurrence("DTSTART:20260101T090000Z;FREQ=DAILY;UNTIL=20260102", {
			allDay: true, completedInstances: ["2025-12-31", "2026-01-02", "2026-01-03"],
		});
		expect(result?.recurrence).toEqual(["RRULE:FREQ=DAILY;UNTIL=20260102", "EXDATE;VALUE=DATE:20260102"]);
	});

	it.each([
		["DTSTART:20260101;FREQ=DAILY;COUNT=2", ["2026-01-02", "2026-01-03"], ["20260102"]],
		["DTSTART:20260105;FREQ=WEEKLY;INTERVAL=4;BYDAY=MO", ["2026-01-12", "2026-02-02"], ["20260202"]],
		["DTSTART:20260101;FREQ=MONTHLY;BYDAY=1MO", ["2026-01-05", "2026-01-12"], ["20260105"]],
		["DTSTART:20260101;FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28", ["2026-02-28", "2026-02-30"], ["20260228"]],
	])("filters exact recurrence membership: %s", (rule, dates, expected) => {
		const result = convertToGoogleRecurrence(rule as string, { completedInstances: dates as string[] });
		expect(result?.recurrence.slice(1)).toEqual((expected as string[]).map((date) => `EXDATE;VALUE=DATE:${date}`));
	});

	it("expands 3,650 exclusions once in under 200ms", () => {
		const dates = Array.from({ length: 3650 }, (_, index) => new Date(Date.UTC(2010, 0, index + 1)).toISOString().slice(0, 10));
		const started = performance.now();
		const result = convertToGoogleRecurrence("DTSTART:20100101;FREQ=DAILY", { completedInstances: dates });
		expect(result?.recurrence).toHaveLength(3651);
		expect(performance.now() - started).toBeLessThan(200);
	});
});
