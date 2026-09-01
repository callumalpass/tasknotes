import {
	applyReminders,
	ownsAlarm,
	readReminders,
	REMINDER_STAMP,
} from "../../../src/services/caldav/vtodoAlarms";
import {
	getComponents,
	parseVTodoDocument,
	serializeVTodoDocument,
	type VTodoDocument,
} from "../../../src/services/caldav/vtodoDocument";
import type { Reminder } from "../../../src/types";

function docWith(...lines: string[]): VTodoDocument {
	const doc = parseVTodoDocument(
		["BEGIN:VCALENDAR", "BEGIN:VTODO", "UID:self", ...lines, "END:VTODO", "END:VCALENDAR"].join(
			"\r\n"
		)
	);
	if (!doc) throw new Error("fixture did not parse");
	return doc;
}

const FOREIGN_ALARM = [
	"BEGIN:VALARM",
	"ACTION:DISPLAY",
	"DESCRIPTION:Set on a phone",
	"TRIGGER;RELATED=START:-PT30M",
	"END:VALARM",
];

describe("applyReminders", () => {
	it("writes a relative reminder anchored to the due date", () => {
		const doc = docWith();
		applyReminders(doc, [
			{ id: "rem_1", type: "relative", relatedTo: "due", offset: "-PT15M" },
		]);

		const output = serializeVTodoDocument(doc);
		expect(output).toContain("BEGIN:VALARM");
		expect(output).toContain("TRIGGER;RELATED=END:-PT15M");
		expect(output).toContain(`${REMINDER_STAMP}:rem_1`);
	});

	it("anchors a scheduled reminder to DTSTART instead", () => {
		const doc = docWith();
		applyReminders(doc, [
			{ id: "rem_1", type: "relative", relatedTo: "scheduled", offset: "-P1D" },
		]);
		expect(serializeVTodoDocument(doc)).toContain("TRIGGER;RELATED=START:-P1D");
	});

	it("writes an absolute reminder as a UTC timestamp", () => {
		const doc = docWith();
		applyReminders(doc, [
			{ id: "rem_1", type: "absolute", absoluteTime: "2026-10-26T09:00:00Z" },
		]);
		expect(serializeVTodoDocument(doc)).toContain("TRIGGER;VALUE=DATE-TIME:20261026T090000Z");
	});

	it("leaves an alarm TaskNotes did not write completely alone", () => {
		// The decision that makes this integration safe to run alongside a phone:
		// a foreign alarm is never matched, so it is never rewritten or dropped.
		const doc = docWith(...FOREIGN_ALARM);
		applyReminders(doc, [
			{ id: "rem_1", type: "relative", relatedTo: "due", offset: "-PT15M" },
		]);

		const output = serializeVTodoDocument(doc);
		expect(output).toContain("DESCRIPTION:Set on a phone");
		expect(output).toContain("TRIGGER;RELATED=START:-PT30M");
		expect(getComponents(doc, "VALARM")).toHaveLength(2);
	});

	it("replaces only its own alarm on a second write", () => {
		const doc = docWith(...FOREIGN_ALARM);
		applyReminders(doc, [
			{ id: "rem_1", type: "relative", relatedTo: "due", offset: "-PT15M" },
		]);
		applyReminders(doc, [
			{ id: "rem_1", type: "relative", relatedTo: "due", offset: "-PT45M" },
		]);

		const output = serializeVTodoDocument(doc);
		expect(getComponents(doc, "VALARM")).toHaveLength(2);
		expect(output).toContain("TRIGGER;RELATED=END:-PT45M");
		expect(output).not.toContain("-PT15M");
		expect(output).toContain("TRIGGER;RELATED=START:-PT30M");
	});

	it("removes its own alarms when every reminder is cleared", () => {
		const doc = docWith(...FOREIGN_ALARM);
		applyReminders(doc, [
			{ id: "rem_1", type: "relative", relatedTo: "due", offset: "-PT15M" },
		]);
		applyReminders(doc, []);

		expect(getComponents(doc, "VALARM")).toHaveLength(1);
		expect(serializeVTodoDocument(doc)).toContain("DESCRIPTION:Set on a phone");
	});

	it("skips a reminder with nothing to trigger on", () => {
		const doc = docWith();
		applyReminders(doc, [{ id: "rem_1", type: "relative" } as Reminder]);
		expect(getComponents(doc, "VALARM")).toHaveLength(0);
	});
});

describe("readReminders", () => {
	it("round-trips a relative reminder", () => {
		const doc = docWith();
		const reminders: Reminder[] = [
			{
				id: "rem_1",
				type: "relative",
				relatedTo: "due",
				offset: "-PT15M",
				description: "Call Max",
			},
		];
		applyReminders(doc, reminders);

		const reparsed = parseVTodoDocument(serializeVTodoDocument(doc));
		expect(readReminders(reparsed!)).toEqual(reminders);
	});

	it("round-trips an absolute reminder", () => {
		const doc = docWith();
		applyReminders(doc, [
			{ id: "rem_1", type: "absolute", absoluteTime: "2026-10-26T09:00:00Z" },
		]);

		const reparsed = parseVTodoDocument(serializeVTodoDocument(doc));
		expect(readReminders(reparsed!)).toEqual([
			{
				id: "rem_1",
				type: "absolute",
				absoluteTime: "2026-10-26T09:00:00Z",
				description: "Reminder",
			},
		]);
	});

	it("ignores alarms without the TaskNotes stamp", () => {
		const doc = docWith(...FOREIGN_ALARM);
		expect(readReminders(doc)).toEqual([]);
	});

	it("preserves a description containing escaped characters", () => {
		const doc = docWith();
		applyReminders(doc, [
			{
				id: "rem_1",
				type: "relative",
				relatedTo: "due",
				offset: "-PT5M",
				description: "Call Max, then; go",
			},
		]);

		const reparsed = parseVTodoDocument(serializeVTodoDocument(doc));
		expect(readReminders(reparsed!)[0].description).toBe("Call Max, then; go");
	});
});

describe("ownsAlarm", () => {
	it("recognises only stamped alarms", () => {
		expect(ownsAlarm(FOREIGN_ALARM)).toBe(false);
		expect(ownsAlarm([...FOREIGN_ALARM, `${REMINDER_STAMP}:rem_1`])).toBe(true);
	});
});
