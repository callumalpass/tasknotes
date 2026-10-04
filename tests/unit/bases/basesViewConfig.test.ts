import {
	readBasesViewConfigValue,
	readBasesViewPropertyId,
} from "../../../src/bases/basesViewConfig";

const config = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] });

describe("Bases view settings compatibility", () => {
	it.each(["config", "options"])("reads legacy %s settings without mutating them", (wrapper) => {
		const values = Object.freeze({ [wrapper]: Object.freeze({ hideEmptyColumns: true }) });
		expect(readBasesViewConfigValue(config(values), "hideEmptyColumns")).toBe(true);
		expect(values).toEqual({ [wrapper]: { hideEmptyColumns: true } });
	});

	it.each([false, 0, "", [], {}])("preserves an explicit direct value: %p", (value) => {
		expect(readBasesViewConfigValue(config({
			setting: value,
			config: { setting: "config" },
			options: { setting: "options" },
		}), "setting")).toBe(value);
	});

	it("resolves settings per key with direct > config > options precedence", () => {
		const reader = config({
			a: false,
			config: { a: true, b: 0, c: null },
			options: { a: true, b: 1, c: "fallback", d: "options" },
		});
		expect(["a", "b", "c", "d", "missing"].map(key => readBasesViewConfigValue(reader, key)))
			.toEqual([false, 0, "fallback", "options", undefined]);
	});

	it.each([null, undefined, true, 42, "invalid", [{ setting: true }]])(
		"ignores malformed wrappers: %p", (value) => {
			expect(readBasesViewConfigValue(config({ config: value, options: { setting: false } }), "setting"))
				.toBe(false);
		});

	it("ignores inherited nested settings", () => {
		expect(readBasesViewConfigValue(config({ options: Object.create({ setting: true }) }), "setting"))
			.toBeUndefined();
	});

	it("handles unavailable readers", () => {
		expect(readBasesViewConfigValue(undefined, "setting")).toBeUndefined();
	});

	it.each([
		["priority", "note.priority"],
		["file", "file.file"],
		["note.contexts", "note.contexts"],
		["file.folder", "file.folder"],
		["formula.stage", "formula.stage"],
		["task.priority", "note.task.priority"],
		["", null],
		[false, null],
	])("normalizes legacy property %p as %p", (value, expected) => {
		expect(readBasesViewPropertyId(config({ options: { swimLane: value } }), "swimLane"))
			.toBe(expected);
	});

	it("lets an empty direct property disable a legacy swimlane", () => {
		expect(readBasesViewPropertyId(config({ swimLane: "", config: { swimLane: "priority" } }), "swimLane"))
			.toBeNull();
	});
});
