import { describe, it, expect } from "@jest/globals";
import {
	mergeUserSwimLaneOrder,
	mergeReorderedVisibleKeys,
	parseSwimLaneOrderConfig,
} from "../../../src/bases/swimLaneOrdering";

describe("mergeUserSwimLaneOrder", () => {
	it("returns defaultOrderedKeys unchanged when savedOrder is empty", () => {
		const defaultOrderedKeys = ["high", "normal", "low", "None"];
		const result = mergeUserSwimLaneOrder([], defaultOrderedKeys);
		expect(result).toEqual(["high", "normal", "low", "None"]);
	});

	it("returns savedOrder when it is a permutation of defaultOrderedKeys", () => {
		const result = mergeUserSwimLaneOrder(
			["low", "high", "None", "normal"],
			["high", "normal", "low", "None"]
		);
		expect(result).toEqual(["low", "high", "None", "normal"]);
	});

	it("drops saved keys that are no longer in defaultOrderedKeys", () => {
		const result = mergeUserSwimLaneOrder(
			["low", "obsolete", "high", "alsoGone"],
			["high", "normal", "low"]
		);
		expect(result).toEqual(["low", "high", "normal"]);
	});

	it("appends new default keys after saved entries in default's relative order", () => {
		const result = mergeUserSwimLaneOrder(
			["low", "high"],
			["urgent", "high", "normal", "low", "trivial"]
		);
		expect(result).toEqual(["low", "high", "urgent", "normal", "trivial"]);
	});

	it("returns empty array when defaultOrderedKeys is empty even with saved entries", () => {
		const result = mergeUserSwimLaneOrder(["a", "b", "c"], []);
		expect(result).toEqual([]);
	});
});

describe("parseSwimLaneOrderConfig", () => {
	it("parses a valid JSON string into a Record of string arrays", () => {
		const input = '{"task.priority":["high","normal","low"]}';
		expect(parseSwimLaneOrderConfig(input)).toEqual({
			"task.priority": ["high", "normal", "low"],
		});
	});

	it("returns {} for null", () => {
		expect(parseSwimLaneOrderConfig(null)).toEqual({});
	});

	it("returns {} for undefined", () => {
		expect(parseSwimLaneOrderConfig(undefined)).toEqual({});
	});

	it("returns {} for malformed JSON", () => {
		expect(parseSwimLaneOrderConfig("{not json}")).toEqual({});
	});

	it("returns {} when parsed JSON is not an object (array)", () => {
		expect(parseSwimLaneOrderConfig('["a","b"]')).toEqual({});
	});

	it("returns {} when parsed JSON is not an object (string)", () => {
		expect(parseSwimLaneOrderConfig('"hello"')).toEqual({});
	});

	it("drops entries whose value is not an array of strings", () => {
		const input = JSON.stringify({
			good: ["a", "b"],
			notArray: "string-value",
			numericArray: [1, 2, 3],
			mixedArray: ["ok", 5],
			nestedObject: { foo: "bar" },
		});
		expect(parseSwimLaneOrderConfig(input)).toEqual({
			good: ["a", "b"],
		});
	});
});

describe("mergeReorderedVisibleKeys", () => {
	it("returns reordered keys as-is when nothing is hidden", () => {
		const result = mergeReorderedVisibleKeys(
			["A", "B", "C"],
			["C", "A", "B"]
		);
		expect(result).toEqual(["C", "A", "B"]);
	});

	it("anchors a single hidden key at its previous position", () => {
		// prev=[A,B,C,D], B hidden, user reorders visible to [D,A,C]
		const result = mergeReorderedVisibleKeys(
			["A", "B", "C", "D"],
			["D", "A", "C"]
		);
		expect(result).toEqual(["D", "B", "A", "C"]);
	});

	it("anchors multiple hidden keys at their previous positions", () => {
		// prev=[A,B,C,D,E], B and D hidden, user reorders visible to [E,A,C]
		const result = mergeReorderedVisibleKeys(
			["A", "B", "C", "D", "E"],
			["E", "A", "C"]
		);
		expect(result).toEqual(["E", "B", "A", "D", "C"]);
	});

	it("appends newly visible keys (not in previousOrder) to the end", () => {
		// prev=[A,B,C], all visible, NEW just appeared and was placed first by user
		const result = mergeReorderedVisibleKeys(
			["A", "B", "C"],
			["NEW", "A", "B", "C"]
		);
		// Visible positions in prev fill from reorderedVisibleKeys[0..2],
		// then "NEW" goes at the end as a leftover.
		expect(result).toEqual(["NEW", "A", "B", "C"]);
	});

	it("preserves a previous key that is neither visible nor in the reorder", () => {
		// prev=[A,B,C], B hidden and not in visible list, user reorders [C,A]
		const result = mergeReorderedVisibleKeys(
			["A", "B", "C"],
			["C", "A"]
		);
		expect(result).toEqual(["C", "B", "A"]);
	});

	it("returns previousOrder unchanged when reorderedVisibleKeys is empty", () => {
		const result = mergeReorderedVisibleKeys(["A", "B", "C"], []);
		expect(result).toEqual(["A", "B", "C"]);
	});
});
