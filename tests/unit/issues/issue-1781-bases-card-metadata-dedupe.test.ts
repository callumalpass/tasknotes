import { PropertyMappingService } from "../../../src/bases/PropertyMappingService";

describe("Issue #1781: Bases card metadata property dedupe", () => {
	const fieldMapperStub = {
		isRecognizedProperty: jest.fn((propertyId: string) =>
			["due", "scheduled"].includes(propertyId)
		),
		getMapping: jest.fn(() => ({})),
		toUserField: jest.fn((key: string) => key),
		fromUserField: jest.fn(() => null),
	};

	it("deduplicates bare and note-prefixed properties after mapping", () => {
		const mapper = new PropertyMappingService({} as any, fieldMapperStub as any);

		expect(
			mapper.mapVisibleProperties(["scheduled", "due", "note.due", "note.scheduled"])
		).toEqual(["scheduled", "due"]);
	});

	it("preserves the first occurrence order for unique mapped properties", () => {
		const mapper = new PropertyMappingService({} as any, fieldMapperStub as any);

		expect(
			mapper.mapVisibleProperties(["note.due", "scheduled", "file.tasks", "formula.checklistProgress"])
		).toEqual(["due", "scheduled", "checklistProgress"]);
	});
});
