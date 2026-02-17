import { describe, expect, it } from "@jest/globals";
import { MdbaseSpecService } from "../../../src/services/MdbaseSpecService";
import { FieldMapper } from "../../../src/services/FieldMapper";
import {
	DEFAULT_FIELD_MAPPING,
	DEFAULT_PRIORITIES,
	DEFAULT_STATUSES,
} from "../../../src/settings/defaults";

function createMockPlugin(overrides: Record<string, unknown> = {}): any {
	const settings = {
		enableMdbaseSpec: true,
		taskIdentificationMethod: "tag",
		taskTag: "task",
		taskPropertyName: "",
		taskPropertyValue: "",
		fieldMapping: { ...DEFAULT_FIELD_MAPPING },
		customStatuses: [...DEFAULT_STATUSES],
		customPriorities: [...DEFAULT_PRIORITIES],
		defaultTaskStatus: "open",
		defaultTaskPriority: "normal",
		userFields: [],
		...overrides,
	};

	return {
		settings,
		fieldMapper: new FieldMapper(settings.fieldMapping),
	};
}

function extractFrontmatter(markdown: string): string {
	const match = markdown.match(/^---\n([\s\S]*?)\n---/);
	return match ? match[1] : "";
}

function extractTypeMatchValue(frontmatter: string): string | undefined {
	const propertyBlockMatch = frontmatter.match(/^\s*"type":\n\s*eq:\s*(.+)$/m);
	if (!propertyBlockMatch) {
		return undefined;
	}

	return propertyBlockMatch[1].trim().replace(/^"|"$/g, "");
}

function legacyCliTypeSeed(typeDefinitionName: string): string {
	return typeDefinitionName;
}

describe("issue #1618 mdbase CLI identification mismatch", () => {
	it.skip("reproduces issue #1618", () => {
		const service = new MdbaseSpecService(
			createMockPlugin({
				taskIdentificationMethod: "property",
				taskPropertyName: "type",
				taskPropertyValue: "Tasks",
			})
		);

		const taskTypeDef = service.buildTaskTypeDef();
		const requiredTypeValue = extractTypeMatchValue(extractFrontmatter(taskTypeDef));

		expect(requiredTypeValue).toBe("Tasks");

		// Legacy mtn behavior seeded `type` from definition name (`task`), not match rule.
		const persistedTypeValue = legacyCliTypeSeed("task");

		// Fixed behavior should respect the configured task-identification value.
		expect(persistedTypeValue).toBe(requiredTypeValue);
	});
});
