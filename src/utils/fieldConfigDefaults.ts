import { uiData } from "../i18n/dataText";


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
		displayName: uiData("Basic Information", "Writable persisted field/group name; preserve configured settings across locales"),
		order: 0,
		collapsible: false,
		defaultCollapsed: false,
	},
	{
		id: "metadata",
		displayName: uiData("Metadata", "Writable persisted field/group name; preserve configured settings across locales"),
		order: 1,
		collapsible: true,
		defaultCollapsed: false,
	},
	{
		id: "organization",
		displayName: uiData("Organization", "Writable persisted field/group name; preserve configured settings across locales"),
		order: 2,
		collapsible: true,
		defaultCollapsed: false,
	},
	{
		id: "dependencies",
		displayName: uiData("Dependencies", "Writable persisted field/group name; preserve configured settings across locales"),
		order: 3,
		collapsible: true,
		defaultCollapsed: false,
	},
	{
		id: "custom",
		displayName: uiData("Custom Fields", "Writable persisted field/group name; preserve configured settings across locales"),
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
		displayName: uiData("Title", "Writable persisted field/group name; preserve configured settings across locales"),
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
		displayName: uiData("Details", "Writable persisted field/group name; preserve configured settings across locales"),
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
		displayName: uiData("Contexts", "Writable persisted field/group name; preserve configured settings across locales"),
		visibleInCreation: true,
		visibleInEdit: true,
		order: 0,
		enabled: true,
	},
	{
		id: "tags",
		fieldType: "core",
		group: "metadata",
		displayName: uiData("Tags", "Writable persisted field/group name; preserve configured settings across locales"),
		visibleInCreation: true,
		visibleInEdit: true,
		order: 1,
		enabled: true,
	},
	{
		id: "time-estimate",
		fieldType: "core",
		group: "metadata",
		displayName: uiData("Time Estimate", "Writable persisted field/group name; preserve configured settings across locales"),
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
		displayName: uiData("Projects", "Writable persisted field/group name; preserve configured settings across locales"),
		visibleInCreation: true,
		visibleInEdit: true,
		order: 0,
		enabled: true,
	},
	{
		id: "subtasks",
		fieldType: "organization",
		group: "organization",
		displayName: uiData("Subtasks", "Writable persisted field/group name; preserve configured settings across locales"),
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
		displayName: uiData("Blocked By", "Writable persisted field/group name; preserve configured settings across locales"),
		visibleInCreation: true,
		visibleInEdit: true,
		order: 0,
		enabled: true,
	},
	{
		id: "blocking",
		fieldType: "dependency",
		group: "dependencies",
		displayName: uiData("Blocking", "Writable persisted field/group name; preserve configured settings across locales"),
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
		fields: DEFAULT_CORE_FIELDS.map((field) => ({ ...field })),
		groups: DEFAULT_FIELD_GROUPS.map((group) => ({ ...group })),
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
		displayName: userField.displayName || uiData(`Field ${index + 1}`, "Stable persisted seed for an unnamed migrated user field; never snapshot the active UI language"),
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
