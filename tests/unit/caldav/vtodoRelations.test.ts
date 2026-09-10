import {
	applyRelations,
	ownsRelation,
	readRelations,
} from "../../../src/services/caldav/vtodoRelations";
import {
	parseVTodoDocument,
	serializeVTodoDocument,
	type VTodoDocument,
} from "../../../src/services/caldav/vtodoDocument";

function docWith(...lines: string[]): VTodoDocument {
	const doc = parseVTodoDocument(
		["BEGIN:VCALENDAR", "BEGIN:VTODO", "UID:self", ...lines, "END:VTODO", "END:VCALENDAR"].join(
			"\r\n"
		)
	);
	if (!doc) throw new Error("fixture did not parse");
	return doc;
}

describe("readRelations", () => {
	it("reads an explicit parent", () => {
		const doc = docWith("RELATED-TO;RELTYPE=PARENT:parent-uid");
		expect(readRelations(doc).parents).toEqual(["parent-uid"]);
	});

	it("treats a missing RELTYPE as PARENT", () => {
		// RFC 5545 makes PARENT the default, and Nextcloud Tasks relies on it
		// when it writes a subtask.
		const doc = docWith("RELATED-TO:parent-uid");
		expect(readRelations(doc).parents).toEqual(["parent-uid"]);
	});

	it("reads several parents, since a task can sit under many projects", () => {
		const doc = docWith("RELATED-TO:one", "RELATED-TO;RELTYPE=PARENT:two");
		expect(readRelations(doc).parents).toEqual(["one", "two"]);
	});

	it("reads a dependency with its reltype and gap", () => {
		const doc = docWith("RELATED-TO;RELTYPE=FINISHTOSTART;GAP=PT2H:blocker-uid");
		expect(readRelations(doc).dependencies).toEqual([
			{ uid: "blocker-uid", reltype: "FINISHTOSTART", gap: "PT2H" },
		]);
	});

	it("omits gap when the server did not send one", () => {
		const doc = docWith("RELATED-TO;RELTYPE=STARTTOSTART:blocker-uid");
		expect(readRelations(doc).dependencies).toEqual([
			{ uid: "blocker-uid", reltype: "STARTTOSTART" },
		]);
	});

	it("ignores reltypes TaskNotes does not model", () => {
		const doc = docWith("RELATED-TO;RELTYPE=SIBLING:other-uid");
		expect(readRelations(doc)).toEqual({ parents: [], dependencies: [] });
	});

	it("is case-insensitive about the reltype", () => {
		const doc = docWith("RELATED-TO;RELTYPE=parent:parent-uid");
		expect(readRelations(doc).parents).toEqual(["parent-uid"]);
	});

	it("skips an empty value rather than inventing a relation", () => {
		const doc = docWith("RELATED-TO;RELTYPE=PARENT:");
		expect(readRelations(doc).parents).toEqual([]);
	});

	it("does not report the same parent twice", () => {
		const doc = docWith("RELATED-TO:dup", "RELATED-TO;RELTYPE=PARENT:dup");
		expect(readRelations(doc).parents).toEqual(["dup"]);
	});
});

describe("applyRelations", () => {
	it("writes parents and dependencies", () => {
		const doc = docWith();
		applyRelations(doc, {
			parents: ["parent-uid"],
			dependencies: [{ uid: "blocker-uid", reltype: "FINISHTOSTART", gap: "PT2H" }],
		});

		const output = serializeVTodoDocument(doc);
		expect(output).toContain("RELATED-TO;RELTYPE=PARENT:parent-uid");
		expect(output).toContain("RELATED-TO;RELTYPE=FINISHTOSTART;GAP=PT2H:blocker-uid");
	});

	it("preserves reltypes it does not own", () => {
		// The whole point of owning relations per line: another client's SIBLING
		// link has to survive a push from TaskNotes.
		const doc = docWith(
			"RELATED-TO;RELTYPE=SIBLING:sibling-uid",
			"RELATED-TO;RELTYPE=PARENT:old-parent"
		);
		applyRelations(doc, { parents: ["new-parent"], dependencies: [] });

		const output = serializeVTodoDocument(doc);
		expect(output).toContain("RELATED-TO;RELTYPE=SIBLING:sibling-uid");
		expect(output).toContain("RELATED-TO;RELTYPE=PARENT:new-parent");
		expect(output).not.toContain("old-parent");
	});

	it("clears owned relations when the task no longer has any", () => {
		const doc = docWith("RELATED-TO;RELTYPE=PARENT:old-parent");
		applyRelations(doc, { parents: [], dependencies: [] });
		expect(serializeVTodoDocument(doc)).not.toContain("RELATED-TO");
	});

	it("round-trips through a serialize and re-parse", () => {
		const doc = docWith();
		const relations = {
			parents: ["a-uid", "b-uid"],
			dependencies: [{ uid: "c-uid", reltype: "FINISHTOFINISH" as const, gap: "P1D" }],
		};
		applyRelations(doc, relations);

		const reparsed = parseVTodoDocument(serializeVTodoDocument(doc));
		expect(reparsed).not.toBeNull();
		expect(readRelations(reparsed!)).toEqual(relations);
	});

	it("does not duplicate a parent listed twice", () => {
		const doc = docWith();
		applyRelations(doc, { parents: ["same", "same"], dependencies: [] });
		expect(serializeVTodoDocument(doc).match(/RELATED-TO/gu)).toHaveLength(1);
	});

	it("leaves other properties untouched", () => {
		const doc = docWith("SUMMARY:Call Max", "X-APPLE-SORT-ORDER:12");
		applyRelations(doc, { parents: ["parent-uid"], dependencies: [] });

		const output = serializeVTodoDocument(doc);
		expect(output).toContain("SUMMARY:Call Max");
		expect(output).toContain("X-APPLE-SORT-ORDER:12");
	});
});

describe("ownsRelation", () => {
	it("claims parents and dependencies but nothing else", () => {
		expect(ownsRelation({ name: "RELATED-TO", params: {}, value: "x" })).toBe(true);
		expect(
			ownsRelation({ name: "RELATED-TO", params: { RELTYPE: "FINISHTOSTART" }, value: "x" })
		).toBe(true);
		expect(ownsRelation({ name: "RELATED-TO", params: { RELTYPE: "SIBLING" }, value: "x" })).toBe(
			false
		);
	});
});
