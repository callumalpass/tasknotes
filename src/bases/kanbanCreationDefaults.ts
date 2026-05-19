import type { FieldMappingKey } from "../types";
import type { UserMappedField } from "../types/settings";
import type {
	BasesCreateFileFrontmatter,
	TaskCreationFieldMapper,
} from "./basesTaskCreation";

export type KanbanCreationPropertyMapper = {
	basesToUserProperty(propertyId: string): string;
};

type KanbanCreationUserField = Pick<UserMappedField, "key" | "type">;

export type KanbanCreationDefaultOptions = {
	frontmatter: BasesCreateFileFrontmatter;
	propertyId: string | null | undefined;
	groupKey: string | null | undefined;
	propertyMapper: KanbanCreationPropertyMapper;
	fieldMapper: TaskCreationFieldMapper;
	userFields?: readonly KanbanCreationUserField[];
	isListTypeProperty: (property: string) => boolean;
	coerceGroupKeyForFrontmatter: (property: string, groupKey: string) => string | number | boolean;
};

export type KanbanCreatableFrontmatterPropertyOptions = {
	propertyId: string;
	propertyMapper: KanbanCreationPropertyMapper;
	fieldMapper: TaskCreationFieldMapper;
	userFields?: readonly Pick<UserMappedField, "key">[];
};

export type KanbanCreationListPropertyOptions = {
	property: string;
	fieldMapper: TaskCreationFieldMapper;
	userFields?: readonly KanbanCreationUserField[];
	isListTypeProperty: (property: string) => boolean;
};

const KANBAN_CREATION_CORE_FIELDS = [
	"status",
	"priority",
	"due",
	"scheduled",
	"contexts",
	"projects",
	"timeEstimate",
	"recurrence",
	"blockedBy",
] as const satisfies readonly FieldMappingKey[];

export function applyKanbanCreationDefault(options: KanbanCreationDefaultOptions): void {
	const { frontmatter, propertyId, groupKey } = options;
	if (!propertyId || !groupKey || groupKey === "None") {
		return;
	}

	const property = getKanbanCreatableFrontmatterProperty({
		propertyId,
		propertyMapper: options.propertyMapper,
		fieldMapper: options.fieldMapper,
		userFields: options.userFields,
	});
	if (!property) {
		return;
	}

	if (
		isKanbanCreationListProperty({
			property,
			fieldMapper: options.fieldMapper,
			userFields: options.userFields,
			isListTypeProperty: options.isListTypeProperty,
		})
	) {
		appendFrontmatterListValue(frontmatter, property, groupKey);
		return;
	}

	frontmatter[property] = options.coerceGroupKeyForFrontmatter(property, groupKey);
}

export function getKanbanCreatableFrontmatterProperty(
	options: KanbanCreatableFrontmatterPropertyOptions
): string | null {
	if (options.propertyId.startsWith("file.") || options.propertyId.startsWith("formula.")) {
		return null;
	}

	const property = options.propertyMapper.basesToUserProperty(options.propertyId);
	const allowedProperties = new Set([
		...KANBAN_CREATION_CORE_FIELDS.map((field) => options.fieldMapper.toUserField(field)),
		"tags",
	]);

	if (allowedProperties.has(property)) {
		return property;
	}

	return options.userFields?.some((field) => field.key === property) ? property : null;
}

export function isKanbanCreationListProperty(
	options: KanbanCreationListPropertyOptions
): boolean {
	if (getCoreKanbanCreationListProperties(options.fieldMapper).has(options.property)) {
		return true;
	}

	const userField = options.userFields?.find((field) => field.key === options.property);
	return userField?.type === "list" || options.isListTypeProperty(options.property);
}

function getCoreKanbanCreationListProperties(fieldMapper: TaskCreationFieldMapper): Set<string> {
	return new Set([
		"tags",
		fieldMapper.toUserField("contexts"),
		fieldMapper.toUserField("projects"),
		fieldMapper.toUserField("blockedBy"),
	]);
}

function appendFrontmatterListValue(
	frontmatter: BasesCreateFileFrontmatter,
	property: string,
	value: string
): void {
	const existing = frontmatter[property];
	const values = Array.isArray(existing)
		? existing.filter((item): item is string => typeof item === "string")
		: typeof existing === "string"
			? [existing]
			: [];
	if (!values.includes(value)) {
		frontmatter[property] = [...values, value];
	}
}
