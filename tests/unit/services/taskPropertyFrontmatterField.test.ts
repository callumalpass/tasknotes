import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import {
	assertValidFrontmatterFieldName,
	resolveTaskPropertyFrontmatterField,
	type TaskPropertyFieldMapper,
} from "../../../src/services/task-service/taskPropertyFrontmatterField";
import type { FieldMapping, FieldMappingKey } from "../../../src/types";

function createFieldMapper(mapping: FieldMapping = DEFAULT_FIELD_MAPPING): TaskPropertyFieldMapper {
	return {
		getMapping: jest.fn(() => mapping),
		toUserField: jest.fn((field: FieldMappingKey) => mapping[field]),
	};
}

describe("taskPropertyFrontmatterField", () => {
	it("maps FieldMapping-backed TaskInfo keys through the configured mapping", () => {
		const fieldMapper = createFieldMapper({
			...DEFAULT_FIELD_MAPPING,
			priority: "task_priority",
		});

		expect(resolveTaskPropertyFrontmatterField(fieldMapper, "priority")).toBe("task_priority");
		expect(fieldMapper.toUserField).toHaveBeenCalledWith("priority");
	});

	it("maps TaskInfo aliases through their FieldMapping keys", () => {
		const fieldMapper = createFieldMapper({
			...DEFAULT_FIELD_MAPPING,
			recurrenceAnchor: "repeat_from",
		});

		expect(resolveTaskPropertyFrontmatterField(fieldMapper, "recurrence_anchor")).toBe(
			"repeat_from"
		);
		expect(fieldMapper.toUserField).toHaveBeenCalledWith("recurrenceAnchor");
	});

	it("keeps persisted TaskInfo keys that are not configurable fields literal", () => {
		const fieldMapper = createFieldMapper();

		expect(resolveTaskPropertyFrontmatterField(fieldMapper, "tags")).toBe("tags");
		expect(fieldMapper.toUserField).not.toHaveBeenCalledWith("tags");
	});

	it("rejects invalid resolved frontmatter field names", () => {
		const fieldMapper = createFieldMapper({
			...DEFAULT_FIELD_MAPPING,
			priority: undefined as unknown as string,
		});

		expect(() => resolveTaskPropertyFrontmatterField(fieldMapper, "priority")).toThrow(
			/frontmatter field name/
		);
	});

	it("rejects non-string and blank field names before frontmatter mutation", () => {
		expect(() => assertValidFrontmatterFieldName(undefined)).toThrow(/non-string/);
		expect(() => assertValidFrontmatterFieldName("")).toThrow(/invalid/);
		expect(assertValidFrontmatterFieldName("undefined")).toBe("undefined");
		expect(assertValidFrontmatterFieldName("custom field")).toBe("custom field");
	});
});
