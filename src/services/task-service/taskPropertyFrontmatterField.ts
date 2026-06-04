import type { FieldMapping, FieldMappingKey, TaskInfo } from "../../types";

export interface TaskPropertyFieldMapper {
	getMapping(): FieldMapping;
	toUserField(field: FieldMappingKey): string;
}

const TASK_PROPERTY_FIELD_MAPPING_ALIASES: Partial<Record<keyof TaskInfo, FieldMappingKey>> = {
	recurrence_anchor: "recurrenceAnchor",
	complete_instances: "completeInstances",
	skipped_instances: "skippedInstances",
	recurrence_parent: "recurrenceParent",
	occurrence_date: "occurrenceDate",
	occurrence_materialization: "occurrenceMaterialization",
	occurrence_next_trigger: "occurrenceNextTrigger",
	occurrence_template: "occurrenceTemplate",
	occurrence_past_horizon: "occurrencePastHorizon",
	occurrence_future_horizon: "occurrenceFutureHorizon",
};

function isFieldMappingKey(property: PropertyKey, mapping: FieldMapping): property is FieldMappingKey {
	return typeof property === "string" && Object.prototype.hasOwnProperty.call(mapping, property);
}

export function assertValidFrontmatterFieldName(
	fieldName: unknown,
	context = "frontmatter field"
): string {
	if (typeof fieldName !== "string") {
		throw new Error(`${context} resolved to a non-string frontmatter field name`);
	}

	if (fieldName.trim().length === 0) {
		throw new Error(`${context} resolved to an invalid frontmatter field name: ${fieldName}`);
	}

	return fieldName;
}

export function resolveTaskPropertyFrontmatterField(
	fieldMapper: TaskPropertyFieldMapper,
	property: keyof TaskInfo
): string {
	const mapping = fieldMapper.getMapping();

	if (isFieldMappingKey(property, mapping)) {
		return assertValidFrontmatterFieldName(
			fieldMapper.toUserField(property),
			`field mapping for ${String(property)}`
		);
	}

	const mappedKey = TASK_PROPERTY_FIELD_MAPPING_ALIASES[property];
	if (mappedKey) {
		return assertValidFrontmatterFieldName(
			fieldMapper.toUserField(mappedKey),
			`field mapping for ${String(property)}`
		);
	}

	return assertValidFrontmatterFieldName(String(property), `task property ${String(property)}`);
}
