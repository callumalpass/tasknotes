import { PropertyMappingService } from "../../../src/bases/PropertyMappingService";
import type { FieldMapper } from "../../../src/services/FieldMapper";

function createFieldMapperStub(): FieldMapper {
	return {
		isRecognizedProperty: jest.fn((property: string) => property === "due"),
		getMapping: jest.fn(() => ({ due: "due" })),
		toUserField: jest.fn((field: string) => field),
		lookupMappingKey: jest.fn((property: string) => (property === "due" ? "due" : undefined)),
	} as unknown as FieldMapper;
}

describe("PropertyMappingService", () => {
	it("depends on FieldMapper directly instead of a plugin object", () => {
		const fieldMapper = createFieldMapperStub();
		const mapper = new PropertyMappingService(fieldMapper);

		expect(mapper.basesToTaskCardProperty("note.due")).toBe("due");
		expect(mapper.basesToTaskInfoProperty("note.due")).toBe("due");
	});

	it("keeps the legacy two-argument constructor shape compatible", () => {
		const fieldMapper = createFieldMapperStub();
		const mapper = new PropertyMappingService({ unused: true }, fieldMapper);

		expect(mapper.internalToUserProperty("due")).toBe("due");
	});
});
