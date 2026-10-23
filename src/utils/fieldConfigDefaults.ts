import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import type {
	ModalFieldConfig,
	TaskModalFieldsConfig,
	FieldGroupConfig,
	FieldGroup,
	UserMappedField,
} from "../types/settings";

/**
 * Default field group configurations
 */
export const DEFAULT_FIELD_GROUPS: FieldGroupConfig[] = [
	{
		id: "basic",
		get displayName() { return uiText(msg({ message: "Basic Information", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		order: 0,
		collapsible: false,
		defaultCollapsed: false,
	},
	{
		id: "metadata",
		get displayName() { return uiText(msg({ message: "Metadata", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		order: 1,
		collapsible: true,
		defaultCollapsed: false,
	},
	{
		id: "organization",
		get displayName() { return uiText(msg({ message: "Organization", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		order: 2,
		collapsible: true,
		defaultCollapsed: false,
	},
	{
		id: "dependencies",
		get displayName() { return uiText(msg({ message: "Dependencies", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		order: 3,
		collapsible: true,
		defaultCollapsed: false,
	},
	{
		id: "custom",
		get displayName() { return uiText(msg({ message: "Custom Fields", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		order: 4,
		collapsible: true,
		defaultCollapsed: false,
	},
];

/**
 * Default core field configurations
 * These are the built-in fields that come with TaskNotes
 */
export const DEFAULT_CORE_FIELDS: ModalFieldConfig[] = [
	// Basic group
	{
		id: "title",
		fieldType: "core",
		group: "basic",
		get displayName() { return uiText(msg({ message: "Title", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		visibleInCreation: true,
		visibleInEdit: true,
		order: 0,
		enabled: true,
		required: true,
	},
	{
		id: "details",
		fieldType: "core",
		group: "basic",
		get displayName() { return uiText(msg({ message: "Details", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		visibleInCreation: true,
		visibleInEdit: true,
		order: 1,
		enabled: true,
	},

	// Metadata group
	{
		id: "contexts",
		fieldType: "core",
		group: "metadata",
		get displayName() { return uiText(msg({ message: "Contexts", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		visibleInCreation: true,
		visibleInEdit: true,
		order: 0,
		enabled: true,
	},
	{
		id: "tags",
		fieldType: "core",
		group: "metadata",
		get displayName() { return uiText(msg({ message: "Tags", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		visibleInCreation: true,
		visibleInEdit: true,
		order: 1,
		enabled: true,
	},
	{
		id: "time-estimate",
		fieldType: "core",
		group: "metadata",
		get displayName() { return uiText(msg({ message: "Time Estimate", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		visibleInCreation: true,
		visibleInEdit: true,
		order: 2,
		enabled: true,
	},

	// Organization group
	{
		id: "projects",
		fieldType: "organization",
		group: "organization",
		get displayName() { return uiText(msg({ message: "Projects", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		visibleInCreation: true,
		visibleInEdit: true,
		order: 0,
		enabled: true,
	},
	{
		id: "subtasks",
		fieldType: "organization",
		group: "organization",
		get displayName() { return uiText(msg({ message: "Subtasks", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		visibleInCreation: true,
		visibleInEdit: true,
		order: 1,
		enabled: true,
	},

	// Dependencies group
	{
		id: "blocked-by",
		fieldType: "dependency",
		group: "dependencies",
		get displayName() { return uiText(msg({ message: "Blocked By", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		visibleInCreation: true,
		visibleInEdit: true,
		order: 0,
		enabled: true,
	},
	{
		id: "blocking",
		fieldType: "dependency",
		group: "dependencies",
		get displayName() { return uiText(msg({ message: "Blocking", context: "utils/fieldConfigDefaults: defaults displayName" })); },
		visibleInCreation: true,
		visibleInEdit: true,
		order: 1,
		enabled: true,
	},
];

/**
 * Create default field configuration
 */
export function createDefaultFieldConfig(): TaskModalFieldsConfig {
	return {
		version: 1,
		fields: [...DEFAULT_CORE_FIELDS],
		groups: [...DEFAULT_FIELD_GROUPS],
	};
}

/**
 * Get fields for a specific modal type
 */
export function getFieldsForModal(
	config: TaskModalFieldsConfig,
	isCreationMode: boolean
): ModalFieldConfig[] {
	return config.fields
		.filter((field) => field.enabled)
		.filter((field) =>
			isCreationMode ? field.visibleInCreation : field.visibleInEdit
		)
		.sort((a, b) => {
			// First sort by group order
			const groupA = config.groups.find((g) => g.id === a.group);
			const groupB = config.groups.find((g) => g.id === b.group);
			const groupOrderDiff = (groupA?.order ?? 0) - (groupB?.order ?? 0);
			if (groupOrderDiff !== 0) return groupOrderDiff;

			// Then by field order within group
			return a.order - b.order;
		});
}

/**
 * Get fields grouped by their group
 */
export function getFieldsByGroup(
	config: TaskModalFieldsConfig,
	isCreationMode: boolean
): Map<FieldGroup, ModalFieldConfig[]> {
	const fields = getFieldsForModal(config, isCreationMode);
	const grouped = new Map<FieldGroup, ModalFieldConfig[]>();

	for (const field of fields) {
		const groupFields = grouped.get(field.group) || [];
		groupFields.push(field);
		grouped.set(field.group, groupFields);
	}

	return grouped;
}

/**
 * Migrate existing user fields to the new field configuration system
 */
export function migrateUserFieldsToFieldConfig(
	existingUserFields: UserMappedField[]
): ModalFieldConfig[] {
	if (!existingUserFields || existingUserFields.length === 0) {
		return [];
	}

	return existingUserFields.map((userField, index) => ({
		id: userField.id || `user-${index}`,
		fieldType: "user" as const,
		group: "custom" as const,
		displayName: userField.displayName || uiText(msg({ message: "Field {value1}", context: "utils/fieldConfigDefaults: migrateUserFieldsToFieldConfig displayName" }), { value1: index + 1 }),
		visibleInCreation: true,
		visibleInEdit: true,
		order: index,
		enabled: true,
	}));
}

/**
 * Initialize or migrate field configuration
 */
export function initializeFieldConfig(
	existingConfig?: TaskModalFieldsConfig,
	userFields?: UserMappedField[]
): TaskModalFieldsConfig {
	// If we have an existing config, return it
	if (existingConfig) {
		return existingConfig;
	}

	// Create default config
	const defaultConfig = createDefaultFieldConfig();

	// If we have user fields from the old system, migrate them
	if (userFields && userFields.length > 0) {
		const migratedUserFields = migrateUserFieldsToFieldConfig(userFields);
		defaultConfig.fields.push(...migratedUserFields);
	}

	return defaultConfig;
}
