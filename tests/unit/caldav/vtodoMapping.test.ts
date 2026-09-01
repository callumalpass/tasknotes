import { DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "../../../src/settings/defaults";
import type { TaskInfo } from "../../../src/types";
import {
	applyTaskToVTodo,
	joinRecurrence,
	readVTodoIntoTaskPatch,
	readVTodoRevision,
	readVTodoUid,
	splitRecurrence,
	taskPriorityToVTodo,
	taskStatusToVTodo,
	vTodoPriorityToTaskPriority,
	vTodoStatusToTaskStatus,
	type VTodoMappingContext,
} from "../../../src/services/caldav/vtodoMapping";
import {
	createVTodoDocument,
	getProperty,
	getTextProperty,
	parseVTodoDocument,
	serializeVTodoDocument,
} from "../../../src/services/caldav/vtodoDocument";

const context: VTodoMappingContext = {
	statuses: DEFAULT_STATUSES,
	priorities: DEFAULT_PRIORITIES,
};

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Buy groceries",
		status: "open",
		priority: "normal",
		path: "Tasks/buy-groceries.md",
		archived: false,
		...overrides,
	};
}

describe("status mapping", () => {
	it("derives COMPLETED from the isCompleted flag", () => {
		expect(taskStatusToVTodo("done", context)).toBe("COMPLETED");
	});

	it("maps every other default status to NEEDS-ACTION", () => {
		expect(taskStatusToVTodo("open", context)).toBe("NEEDS-ACTION");
		expect(taskStatusToVTodo("in-progress", context)).toBe("NEEDS-ACTION");
		expect(taskStatusToVTodo("none", context)).toBe("NEEDS-ACTION");
	});

	it("maps an isSkipped status to CANCELLED", () => {
		const withSkipped: VTodoMappingContext = {
			...context,
			statuses: [
				...DEFAULT_STATUSES,
				{
					id: "cancelled",
					value: "cancelled",
					label: "Cancelled",
					color: "#999",
					isCompleted: false,
					isSkipped: true,
					order: 4,
					autoArchive: false,
					autoArchiveDelay: 5,
				},
			],
		};
		expect(taskStatusToVTodo("cancelled", withSkipped)).toBe("CANCELLED");
		expect(vTodoStatusToTaskStatus("CANCELLED", withSkipped)).toBe("cancelled");
	});

	it("honours an explicit override in both directions", () => {
		const overridden: VTodoMappingContext = {
			...context,
			statusOverrides: { "in-progress": "IN-PROCESS" },
		};
		expect(taskStatusToVTodo("in-progress", overridden)).toBe("IN-PROCESS");
		expect(vTodoStatusToTaskStatus("IN-PROCESS", overridden)).toBe("in-progress");
	});

	it("maps inbound statuses to sensible defaults with no override", () => {
		expect(vTodoStatusToTaskStatus("COMPLETED", context)).toBe("done");
		expect(vTodoStatusToTaskStatus("NEEDS-ACTION", context)).toBe("none");
	});

	it("ignores an unknown inbound status rather than guessing", () => {
		expect(vTodoStatusToTaskStatus("NONSENSE", context)).toBeUndefined();
		expect(vTodoStatusToTaskStatus("", context)).toBeUndefined();
	});

	it("falls back to CANCELLED -> a completed status when nothing is skipped", () => {
		// The default configuration has no isSkipped status.
		expect(vTodoStatusToTaskStatus("CANCELLED", context)).toBe("done");
	});
});

describe("priority mapping", () => {
	it("spreads priorities across the 1-9 scale, most urgent lowest", () => {
		expect(taskPriorityToVTodo("high", context)).toBe(1);
		expect(taskPriorityToVTodo("normal", context)).toBe(5);
		expect(taskPriorityToVTodo("low", context)).toBe(9);
	});

	it("treats the zero-weight priority as no PRIORITY at all", () => {
		expect(taskPriorityToVTodo("none", context)).toBeUndefined();
	});

	it("round-trips every weighted priority", () => {
		for (const value of ["high", "normal", "low"]) {
			const mapped = taskPriorityToVTodo(value, context)!;
			expect(vTodoPriorityToTaskPriority(mapped, context)).toBe(value);
		}
	});

	it("snaps an intermediate remote priority to the nearest configured one", () => {
		expect(vTodoPriorityToTaskPriority(2, context)).toBe("high");
		expect(vTodoPriorityToTaskPriority(4, context)).toBe("normal");
		expect(vTodoPriorityToTaskPriority(8, context)).toBe("low");
	});

	it("treats 0 and out-of-range values as unset", () => {
		expect(vTodoPriorityToTaskPriority(0, context)).toBeUndefined();
		expect(vTodoPriorityToTaskPriority(undefined, context)).toBeUndefined();
		expect(vTodoPriorityToTaskPriority(42, context)).toBeUndefined();
	});

	it("handles a single configured priority without dividing by zero", () => {
		const single: VTodoMappingContext = {
			...context,
			priorities: [{ id: "p", value: "p", label: "P", color: "#000", weight: 1 }],
		};
		expect(taskPriorityToVTodo("p", single)).toBe(5);
		expect(vTodoPriorityToTaskPriority(5, single)).toBe("p");
	});
});

describe("recurrence", () => {
	it("splits an embedded DTSTART out of the TaskNotes form", () => {
		expect(splitRecurrence("DTSTART:20240115;FREQ=WEEKLY;BYDAY=MO,TU")).toEqual({
			dtstart: "20240115",
			rule: "FREQ=WEEKLY;BYDAY=MO,TU",
		});
	});

	it("handles a rule with no DTSTART", () => {
		expect(splitRecurrence("FREQ=DAILY")).toEqual({ rule: "FREQ=DAILY" });
	});

	it("strips an RRULE: prefix", () => {
		expect(splitRecurrence("RRULE:FREQ=DAILY").rule).toBe("FREQ=DAILY");
	});

	it("rejoins into the TaskNotes form", () => {
		expect(joinRecurrence("20240115", "FREQ=WEEKLY")).toBe(
			"DTSTART:20240115;FREQ=WEEKLY"
		);
		expect(joinRecurrence(undefined, "FREQ=WEEKLY")).toBe("FREQ=WEEKLY");
	});

	it("round-trips through a VTODO", () => {
		const doc = createVTodoDocument();
		const task = makeTask({
			recurrence: "DTSTART:20240115;FREQ=WEEKLY;BYDAY=MO",
			scheduled: undefined,
		});
		applyTaskToVTodo(doc, task, context, { uid: "u1" });

		expect(getProperty(doc, "RRULE")?.value).toBe("FREQ=WEEKLY;BYDAY=MO");
		expect(getProperty(doc, "DTSTART")?.value).toBe("20240115");

		const patch = readVTodoIntoTaskPatch(doc, context);
		expect(patch.recurrence).toBe("DTSTART:20240115;FREQ=WEEKLY;BYDAY=MO");
	});
});

describe("applyTaskToVTodo", () => {
	it("writes the fields TaskNotes owns", () => {
		const doc = createVTodoDocument();
		const task = makeTask({
			title: "Buy groceries",
			due: "2025-09-03",
			priority: "high",
			tags: ["errands", "shopping"],
		});
		applyTaskToVTodo(doc, task, context, { uid: "uid-1", now: "2025-09-01T12:00:00Z" });

		expect(getTextProperty(doc, "UID")).toBe("uid-1");
		expect(getTextProperty(doc, "SUMMARY")).toBe("Buy groceries");
		expect(getProperty(doc, "DUE")).toMatchObject({
			value: "20250903",
			params: { VALUE: "DATE" },
		});
		expect(getProperty(doc, "STATUS")?.value).toBe("NEEDS-ACTION");
		expect(getProperty(doc, "PRIORITY")?.value).toBe("1");
		expect(getProperty(doc, "DTSTAMP")?.value).toBe("20250901T120000Z");
		expect(getProperty(doc, "CATEGORIES")?.value).toBe("errands,shopping");
	});

	it("writes COMPLETED and PERCENT-COMPLETE for a done task", () => {
		const doc = createVTodoDocument();
		const task = makeTask({ status: "done", completedDate: "2025-09-02" });
		applyTaskToVTodo(doc, task, context, { uid: "uid-1", now: "2025-09-02T09:00:00Z" });

		expect(getProperty(doc, "STATUS")?.value).toBe("COMPLETED");
		expect(getProperty(doc, "PERCENT-COMPLETE")?.value).toBe("100");
		// RFC 5545 requires COMPLETED to be a UTC date-time.
		expect(getProperty(doc, "COMPLETED")?.value).toBe("20250902T000000Z");
	});

	it("clears COMPLETED when a task is reopened", () => {
		const doc = createVTodoDocument();
		applyTaskToVTodo(doc, makeTask({ status: "done", completedDate: "2025-09-02" }), context, {
			uid: "uid-1",
		});
		expect(getProperty(doc, "COMPLETED")).toBeDefined();

		applyTaskToVTodo(doc, makeTask({ status: "open" }), context, { uid: "uid-1" });
		expect(getProperty(doc, "COMPLETED")).toBeUndefined();
		expect(getProperty(doc, "PERCENT-COMPLETE")).toBeUndefined();
		expect(getProperty(doc, "STATUS")?.value).toBe("NEEDS-ACTION");
	});

	it("removes DUE when a task's due date is cleared", () => {
		const doc = createVTodoDocument();
		applyTaskToVTodo(doc, makeTask({ due: "2025-09-03" }), context, { uid: "u" });
		expect(getProperty(doc, "DUE")).toBeDefined();

		applyTaskToVTodo(doc, makeTask({ due: undefined }), context, { uid: "u" });
		expect(getProperty(doc, "DUE")).toBeUndefined();
	});

	it("bumps SEQUENCE on each write", () => {
		const doc = createVTodoDocument();
		applyTaskToVTodo(doc, makeTask(), context, { uid: "u" });
		expect(getProperty(doc, "SEQUENCE")?.value).toBe("1");
		applyTaskToVTodo(doc, makeTask(), context, { uid: "u" });
		expect(getProperty(doc, "SEQUENCE")?.value).toBe("2");
	});

	it("leaves properties it does not own untouched", () => {
		const remote = [
			"BEGIN:VCALENDAR",
			"BEGIN:VTODO",
			"UID:remote-uid",
			"SUMMARY:Old title",
			"DESCRIPTION:A long note body written on the phone",
			"X-APPLE-SORT-ORDER:987",
			"RELATED-TO;RELTYPE=PARENT:parent-uid",
			"BEGIN:VALARM",
			"ACTION:DISPLAY",
			"TRIGGER:-PT15M",
			"END:VALARM",
			"END:VTODO",
			"END:VCALENDAR",
		].join("\r\n");

		const doc = parseVTodoDocument(remote)!;
		applyTaskToVTodo(doc, makeTask({ title: "New title" }), context, {
			uid: "remote-uid",
		});
		const out = serializeVTodoDocument(doc);

		expect(out).toContain("SUMMARY:New title");
		expect(out).toContain("DESCRIPTION:A long note body written on the phone");
		expect(out).toContain("X-APPLE-SORT-ORDER:987");
		expect(out).toContain("RELATED-TO;RELTYPE=PARENT:parent-uid");
		expect(out).toContain("BEGIN:VALARM");
		expect(out).toContain("TRIGGER:-PT15M");
	});
});

describe("readVTodoIntoTaskPatch", () => {
	it("reads a server-authored VTODO", () => {
		const doc = parseVTodoDocument(
			[
				"BEGIN:VCALENDAR",
				"BEGIN:VTODO",
				"UID:abc",
				"SUMMARY:Call the dentist",
				"DUE;VALUE=DATE:20250910",
				"STATUS:NEEDS-ACTION",
				"PRIORITY:1",
				"CATEGORIES:health,calls",
				"END:VTODO",
				"END:VCALENDAR",
			].join("\r\n")
		)!;

		expect(readVTodoIntoTaskPatch(doc, context)).toMatchObject({
			title: "Call the dentist",
			due: "2025-09-10",
			status: "none",
			priority: "high",
			tags: ["health", "calls"],
		});
	});

	it("signals cleared fields with null rather than omitting them", () => {
		const doc = parseVTodoDocument(
			["BEGIN:VCALENDAR", "BEGIN:VTODO", "UID:abc", "END:VTODO", "END:VCALENDAR"].join(
				"\r\n"
			)
		)!;
		const patch = readVTodoIntoTaskPatch(doc, context);

		expect(patch.due).toBeNull();
		expect(patch.scheduled).toBeNull();
		expect(patch.completedDate).toBeNull();
		expect(patch.recurrence).toBeNull();
	});

	it("survives a full task -> VTODO -> task round trip", () => {
		const doc = createVTodoDocument();
		const task = makeTask({
			title: "Round trip",
			status: "done",
			priority: "high",
			due: "2025-09-03",
			scheduled: "2025-09-01",
			completedDate: "2025-09-02",
			tags: ["a", "b"],
		});
		applyTaskToVTodo(doc, task, context, { uid: "u" });

		const reparsed = parseVTodoDocument(serializeVTodoDocument(doc))!;
		expect(readVTodoIntoTaskPatch(reparsed, context)).toMatchObject({
			title: "Round trip",
			status: "done",
			priority: "high",
			due: "2025-09-03",
			scheduled: "2025-09-01",
			completedDate: "2025-09-02",
			tags: ["a", "b"],
		});
	});

	it("reads the UID", () => {
		const doc = createVTodoDocument();
		applyTaskToVTodo(doc, makeTask(), context, { uid: "the-uid" });
		expect(readVTodoUid(doc)).toBe("the-uid");
	});
});

describe("readVTodoRevision", () => {
	function docWith(lines: string[]) {
		return parseVTodoDocument(
			["BEGIN:VCALENDAR", "BEGIN:VTODO", "UID:x", ...lines, "END:VTODO", "END:VCALENDAR"].join(
				"\r\n"
			)
		)!;
	}

	it("prefers LAST-MODIFIED over DTSTAMP", () => {
		const doc = docWith(["DTSTAMP:20250901T120000Z", "LAST-MODIFIED:20250901T130000Z"]);
		expect(readVTodoRevision(doc)).toBe(Date.UTC(2025, 8, 1, 13, 0, 0));
	});

	it("falls back to DTSTAMP, which RFC 5545 defines as the last revision for stored objects", () => {
		expect(readVTodoRevision(docWith(["DTSTAMP:20250901T120000Z"]))).toBe(
			Date.UTC(2025, 8, 1, 12, 0, 0)
		);
	});

	it("returns null when neither is present, so the caller can fall back", () => {
		expect(readVTodoRevision(docWith([]))).toBeNull();
	});
});
