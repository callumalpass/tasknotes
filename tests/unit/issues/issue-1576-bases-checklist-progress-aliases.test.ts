import { PropertyMappingService } from "../../../src/bases/PropertyMappingService";

describe("Issue #1576 - Bases checklist progress aliases", () => {
	const fieldMapperStub = {
		isRecognizedProperty: jest.fn(() => false),
		getMapping: jest.fn(() => ({})),
		toUserField: jest.fn((key: string) => key),
		fromUserField: jest.fn(() => null),
	};

	const mapper = new PropertyMappingService({} as any, fieldMapperStub as any);

	it("maps file.tasks to checklistProgress", () => {
		expect(mapper.basesToTaskCardProperty("file.tasks")).toBe("checklistProgress");
	});

	it("maps formula.checklistProgress to checklistProgress", () => {
		expect(mapper.basesToTaskCardProperty("formula.checklistProgress")).toBe("checklistProgress");
	});

	it("does not map note/task tasks aliases", () => {
		expect(mapper.basesToTaskCardProperty("tasks")).toBe("tasks");
		expect(mapper.basesToTaskCardProperty("note.tasks")).toBe("tasks");
		expect(mapper.basesToTaskCardProperty("task.tasks")).toBe("tasks");
	});
});
