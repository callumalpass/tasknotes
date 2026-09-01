import {
	createVTodoDocument,
	escapeText,
	getProperties,
	getProperty,
	getTextListProperty,
	getTextProperty,
	parseContentLine,
	parseVTodoDocument,
	removeProperty,
	serializeVTodoDocument,
	setProperty,
	setTextListProperty,
	setTextProperty,
	unescapeText,
	unfoldLines,
} from "../../../src/services/caldav/vtodoDocument";

/** A VTODO shaped like something Nextcloud Tasks would actually store. */
const NEXTCLOUD_VTODO = [
	"BEGIN:VCALENDAR",
	"VERSION:2.0",
	"PRODID:-//Nextcloud Tasks//EN",
	"BEGIN:VTODO",
	"UID:abc-123-def",
	"DTSTAMP:20250901T120000Z",
	"SUMMARY:Buy groceries",
	"DUE;VALUE=DATE:20250903",
	"STATUS:NEEDS-ACTION",
	"PRIORITY:5",
	"CATEGORIES:errands,shopping",
	"X-APPLE-SORT-ORDER:12345",
	"BEGIN:VALARM",
	"ACTION:DISPLAY",
	"TRIGGER:-PT15M",
	"DESCRIPTION:Reminder",
	"END:VALARM",
	"END:VTODO",
	"END:VCALENDAR",
].join("\r\n");

describe("parseVTodoDocument", () => {
	it("parses properties and isolates the VTODO", () => {
		const doc = parseVTodoDocument(NEXTCLOUD_VTODO)!;
		expect(doc).not.toBeNull();
		expect(getTextProperty(doc, "UID")).toBe("abc-123-def");
		expect(getTextProperty(doc, "SUMMARY")).toBe("Buy groceries");
		expect(getProperty(doc, "DUE")?.params).toEqual({ VALUE: "DATE" });
		expect(getProperty(doc, "DUE")?.value).toBe("20250903");
	});

	it("is case-insensitive on property lookup", () => {
		const doc = parseVTodoDocument(NEXTCLOUD_VTODO)!;
		expect(getTextProperty(doc, "uid")).toBe("abc-123-def");
	});

	it("returns null when the payload has no VTODO", () => {
		const vevent = [
			"BEGIN:VCALENDAR",
			"BEGIN:VEVENT",
			"UID:x",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");
		expect(parseVTodoDocument(vevent)).toBeNull();
		expect(parseVTodoDocument("<html>404</html>")).toBeNull();
	});

	it("refuses a truncated VTODO rather than syncing half an object", () => {
		const truncated = ["BEGIN:VCALENDAR", "BEGIN:VTODO", "UID:x", "SUMMARY:cut off"].join(
			"\r\n"
		);
		expect(parseVTodoDocument(truncated)).toBeNull();
	});
});

describe("property preservation", () => {
	it("round-trips an untouched document without losing anything", () => {
		const doc = parseVTodoDocument(NEXTCLOUD_VTODO)!;
		const out = serializeVTodoDocument(doc);

		expect(out).toContain("X-APPLE-SORT-ORDER:12345");
		expect(out).toContain("BEGIN:VALARM");
		expect(out).toContain("TRIGGER:-PT15M");
		expect(out).toContain("END:VALARM");
		expect(out).toContain("PRODID:-//Nextcloud Tasks//EN");
		expect(out).toContain("END:VCALENDAR");
	});

	it("keeps unknown properties and VALARM blocks when a known field changes", () => {
		const doc = parseVTodoDocument(NEXTCLOUD_VTODO)!;
		setTextProperty(doc, "SUMMARY", "Buy groceries and milk");
		const out = serializeVTodoDocument(doc);

		expect(out).toContain("SUMMARY:Buy groceries and milk");
		expect(out).not.toContain("SUMMARY:Buy groceries\r\n");
		// The parts we do not model must survive untouched.
		expect(out).toContain("X-APPLE-SORT-ORDER:12345");
		expect(out).toContain("BEGIN:VALARM");
		expect(out).toContain("TRIGGER:-PT15M");
	});

	it("replaces a property in place rather than appending", () => {
		const doc = parseVTodoDocument(NEXTCLOUD_VTODO)!;
		setTextProperty(doc, "SUMMARY", "Changed");
		const lines = serializeVTodoDocument(doc).split("\r\n");

		expect(lines.indexOf("SUMMARY:Changed")).toBeLessThan(
			lines.indexOf("X-APPLE-SORT-ORDER:12345")
		);
		expect(getProperties(doc, "SUMMARY")).toHaveLength(1);
	});

	it("collapses duplicate occurrences on set", () => {
		const doc = parseVTodoDocument(
			[
				"BEGIN:VCALENDAR",
				"BEGIN:VTODO",
				"UID:x",
				"STATUS:NEEDS-ACTION",
				"STATUS:COMPLETED",
				"END:VTODO",
				"END:VCALENDAR",
			].join("\r\n")
		)!;
		expect(getProperties(doc, "STATUS")).toHaveLength(2);

		setProperty(doc, "STATUS", "IN-PROCESS");
		expect(getProperties(doc, "STATUS")).toHaveLength(1);
		expect(getProperty(doc, "STATUS")?.value).toBe("IN-PROCESS");
	});

	it("removes a property without disturbing its neighbours", () => {
		const doc = parseVTodoDocument(NEXTCLOUD_VTODO)!;
		removeProperty(doc, "DUE");
		const out = serializeVTodoDocument(doc);

		expect(out).not.toContain("DUE");
		expect(out).toContain("SUMMARY:Buy groceries");
		expect(out).toContain("BEGIN:VALARM");
	});
});

describe("escaping", () => {
	it("escapes and unescapes the RFC 5545 special characters", () => {
		const raw = 'Call Bob; buy milk, bread\nand "cheese" \\ here';
		expect(unescapeText(escapeText(raw))).toBe(raw);
	});

	it("round-trips a summary containing separators through a document", () => {
		const doc = createVTodoDocument();
		const summary = "Pay invoice; net 30, urgent\nsecond line";
		setTextProperty(doc, "SUMMARY", summary);

		const reparsed = parseVTodoDocument(serializeVTodoDocument(doc))!;
		expect(getTextProperty(reparsed, "SUMMARY")).toBe(summary);
	});

	it("splits CATEGORIES on unescaped commas only", () => {
		const doc = parseVTodoDocument(NEXTCLOUD_VTODO)!;
		expect(getTextListProperty(doc, "CATEGORIES")).toEqual(["errands", "shopping"]);
	});

	it("round-trips a tag that itself contains a comma", () => {
		const doc = createVTodoDocument();
		setTextListProperty(doc, "CATEGORIES", ["home", "shopping, urgent"]);

		const reparsed = parseVTodoDocument(serializeVTodoDocument(doc))!;
		expect(getTextListProperty(reparsed, "CATEGORIES")).toEqual([
			"home",
			"shopping, urgent",
		]);
	});

	it("drops the list property entirely when set to empty", () => {
		const doc = parseVTodoDocument(NEXTCLOUD_VTODO)!;
		setTextListProperty(doc, "CATEGORIES", []);
		expect(serializeVTodoDocument(doc)).not.toContain("CATEGORIES");
	});
});

describe("content line parsing", () => {
	it("parses parameters", () => {
		expect(parseContentLine("DUE;VALUE=DATE:20250903")).toEqual({
			name: "DUE",
			params: { VALUE: "DATE" },
			value: "20250903",
		});
	});

	it("does not split on a colon inside a quoted parameter", () => {
		const parsed = parseContentLine('ATTENDEE;CN="Bob: The Builder":mailto:bob@example.com');
		expect(parsed?.name).toBe("ATTENDEE");
		expect(parsed?.params.CN).toBe("Bob: The Builder");
		expect(parsed?.value).toBe("mailto:bob@example.com");
	});

	it("keeps a URL value intact", () => {
		expect(parseContentLine("URL:https://example.com/a:b")?.value).toBe(
			"https://example.com/a:b"
		);
	});

	it("rejects a line with no value separator", () => {
		expect(parseContentLine("GARBAGE")).toBeNull();
		expect(parseContentLine("")).toBeNull();
	});
});

describe("line folding", () => {
	it("unfolds continuation lines", () => {
		// Exactly one leading space or tab is consumed by the unfold.
		expect(unfoldLines("SUMMARY:Hello\r\n world")).toEqual(["SUMMARY:Helloworld"]);
		expect(unfoldLines("SUMMARY:Hello\r\n  world")).toEqual(["SUMMARY:Hello world"]);
		expect(unfoldLines("SUMMARY:Hello\r\n\tworld")).toEqual(["SUMMARY:Helloworld"]);
	});

	it("folds long lines to 75 octets and survives a round trip", () => {
		const doc = createVTodoDocument();
		const long = `Long summary ${"x".repeat(200)}`;
		setTextProperty(doc, "SUMMARY", long);

		const serialized = serializeVTodoDocument(doc);
		for (const line of serialized.split("\r\n")) {
			expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
		}

		const reparsed = parseVTodoDocument(serialized)!;
		expect(getTextProperty(reparsed, "SUMMARY")).toBe(long);
	});

	it("folds on octet boundaries so multi-byte characters are not split", () => {
		const doc = createVTodoDocument();
		const emoji = "🎉".repeat(60);
		setTextProperty(doc, "SUMMARY", emoji);

		const serialized = serializeVTodoDocument(doc);
		for (const line of serialized.split("\r\n")) {
			expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
		}
		expect(serialized).not.toContain("�");

		const reparsed = parseVTodoDocument(serialized)!;
		expect(getTextProperty(reparsed, "SUMMARY")).toBe(emoji);
	});
});

describe("createVTodoDocument", () => {
	it("produces a parseable minimal VCALENDAR", () => {
		const doc = createVTodoDocument();
		setTextProperty(doc, "UID", "new-uid");
		setTextProperty(doc, "SUMMARY", "Fresh task");

		const serialized = serializeVTodoDocument(doc);
		expect(serialized).toContain("BEGIN:VCALENDAR");
		expect(serialized).toContain("BEGIN:VTODO");
		expect(serialized).toContain("END:VTODO");
		expect(serialized.endsWith("\r\n")).toBe(true);

		const reparsed = parseVTodoDocument(serialized)!;
		expect(getTextProperty(reparsed, "UID")).toBe("new-uid");
	});
});
