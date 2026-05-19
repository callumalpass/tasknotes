import {
	convertBasesGroupKeyToString,
	convertBasesValueToNative,
} from "../../../src/bases/basesValueConversion";

describe("Bases value conversion", () => {
	it("converts primitive, null, file, and date Bases values to native values", () => {
		expect(convertBasesValueToNative({ data: "Done" })).toBe("Done");
		expect(convertBasesValueToNative({ data: 3 })).toBe(3);
		expect(convertBasesValueToNative({ constructor: { name: "NullValue" } })).toBeNull();
		expect(
			convertBasesValueToNative({
				file: { path: "Projects/Launch.md" },
			})
		).toBe("Projects/Launch.md");
		expect(
			convertBasesValueToNative({
				date: new Date("2026-05-19T09:30:00.000Z"),
			})
		).toBe("2026-05-19T09:30:00.000Z");
		expect(
			convertBasesValueToNative({
				constructor: { name: "DateValue" },
				toISOString: () => "2026-05-19T00:00:00.000Z",
			})
		).toBe("2026-05-19T00:00:00.000Z");
	});

	it("converts list values recursively through get/length and value arrays", () => {
		const getListValue = {
			length: () => 2,
			get: (index: number) => [{ data: "Done" }, { file: { path: "P.md" } }][index],
		};
		const arrayListValue = {
			value: [{ data: "Open" }, { constructor: { name: "NullValue" } }],
		};

		expect(convertBasesValueToNative(getListValue)).toEqual(["Done", "P.md"]);
		expect(convertBasesValueToNative(arrayListValue)).toEqual(["Open", null]);
	});

	it("uses meaningful fallback string values when Bases exposes a custom toString", () => {
		const value = {
			toString: () => "Custom value",
		};

		expect(convertBasesValueToNative(value)).toBe("Custom value");
	});

	it("formats group keys for display without leaking Bases wrapper objects", () => {
		expect(convertBasesGroupKeyToString(null)).toBe("Unknown");
		expect(convertBasesGroupKeyToString({ constructor: { name: "NullValue" } })).toBe(
			"Unknown"
		);
		expect(convertBasesGroupKeyToString({ data: null })).toBe("None");
		expect(
			convertBasesGroupKeyToString({
				date: new Date(2026, 4, 19, 15, 30),
			})
		).toBe("2026-05-19");
		expect(
			convertBasesGroupKeyToString({
				length: () => 2,
				at: (index: number) => [{ data: "Done" }, { data: "Archived" }][index],
			})
		).toBe("Done, Archived");
		expect(convertBasesGroupKeyToString({ data: true })).toBe("True");
		expect(convertBasesGroupKeyToString({ data: "" })).toBe("None");
	});
});
