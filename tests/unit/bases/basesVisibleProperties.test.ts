import {
	buildBasesVisibleProperties,
	buildBasesVisiblePropertyLabels,
	type BasesVisiblePropertyMapper,
} from "../../../src/bases/basesVisibleProperties";

function createMapper(
	visibleProperties: string[],
	labelMappings: Record<string, string | null | undefined> = {}
): BasesVisiblePropertyMapper {
	return {
		mapVisibleProperties: jest.fn(() => visibleProperties),
		basesToTaskCardProperty: jest.fn((propertyId) => labelMappings[propertyId]),
	};
}

describe("Bases visible properties", () => {
	it("uses localized field labels for raw identifiers while preserving configured names", () => {
		const labels = buildBasesVisiblePropertyLabels({
			basesPropertyIds: ["note.scheduled", "note.due", "formula.days"],
			propertyMapper: createMapper([], { "note.scheduled": "scheduled", "note.due": "due", "formula.days": "formula.days" }),
			getDisplayName: (propertyId) => propertyId === "note.scheduled" ? "scheduled" : propertyId === "note.due" ? "My deadline" : "Days remaining",
		});
		expect(labels).toEqual({ due: "My deadline", "formula.days": "Days remaining" });
	});
	it("uses mapped Bases properties when the mapper returns visible TaskCard ids", () => {
		const mapper = createMapper(["status", "priority"]);
		const toUserProperties = jest.fn((properties: readonly string[]) => [...properties]);

		const visibleProperties = buildBasesVisibleProperties({
			basesPropertyIds: ["note.status", "note.priority"],
			propertyMapper: mapper,
			fallbackInternalProperties: ["due"],
			toUserProperties,
		});

		expect(visibleProperties).toEqual(["status", "priority"]);
		expect(mapper.mapVisibleProperties).toHaveBeenCalledWith([
			"note.status",
			"note.priority",
		]);
		expect(toUserProperties).not.toHaveBeenCalled();
	});

	it("falls back to configured default properties when Bases has no visible TaskCard fields", () => {
		const mapper = createMapper([]);
		const toUserProperties = jest.fn((properties: readonly string[]) =>
			properties.map((property) => `user.${property}`)
		);

		const visibleProperties = buildBasesVisibleProperties({
			basesPropertyIds: ["formula.unmapped"],
			propertyMapper: mapper,
			fallbackInternalProperties: ["due", "tags"],
			toUserProperties,
		});

		expect(visibleProperties).toEqual(["user.due", "user.tags"]);
		expect(toUserProperties).toHaveBeenCalledWith(["due", "tags"]);
	});

	it("builds TaskCard label overrides from Bases display names", () => {
		const mapper = createMapper([], {
			"note.due": "due",
			"note.scheduled": "scheduled",
			"formula.skip": undefined,
		});

		const labels = buildBasesVisiblePropertyLabels({
			basesPropertyIds: ["note.due", "note.scheduled", "formula.skip", "note.empty"],
			propertyMapper: mapper,
			getDisplayName: (propertyId) => {
				if (propertyId === "note.due") return "Deadline";
				if (propertyId === "note.scheduled") return " ";
				if (propertyId === "note.empty") return "Empty";
				return "Formula";
			},
		});

		expect(labels).toEqual({
			due: "Deadline",
		});
	});
});
