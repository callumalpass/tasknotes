import type {
	ModalFieldConfig,
	TaskModalFieldsConfig,
	FieldGroupConfig,
	FieldGroup,
} from "../types/settings";

/**
 * Default field group configurations
 */
export const DEFAULT_FIELD_GROUPS: FieldGroupConfig[] = [
	{
		id: "basic",
		displayName: "Basic Information",
		order: 0,
		collapsible: false,
		defaultCollapsed: false,
	},
	{
		id: "metadata",
		displayName: "Metadata",
		order: 1,
		collapsible: true,
		defaultCollapsed: false,
	},
	{
		id: "organization",
		displayName: "Organization",
		order: 2,
		collapsible: true,
		defaultCollapsed: false,
	},
	{
		id: "dependencies",
		displayName: "Dependencies",
		order: 3,
		collapsible: true,
		defaultCollapsed: false,
	},
	{
		id: "custom",
		displayName: "Custom Fields",
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
		displayName: "Title",
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
		displayName: "Details",
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
		displayName: "Contexts",
		visibleInCreation: true,
		visibleInEdit: true,
		order: 0,
		enabled: true,
	},
	{
		id: "tags",
		fieldType: "core",
		group: "metadata",
		displayName: "Tags",
		visibleInCreation: true,
		visibleInEdit: true,
		order: 1,
		enabled: true,
	},
	{
		id: "time-estimate",
		fieldType: "core",
		group: "metadata",
		displayName: "Time Estimate",
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
		displayName: "Projects",
		visibleInCreation: true,
		visibleInEdit: true,
		order: 0,
		enabled: true,
	},
	{
		id: "subtasks",
		fieldType: "organization",
		group: "organization",
		displayName: "Subtasks",
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
		displayName: "Blocked By",
		visibleInCreation: true,
		visibleInEdit: true,
		order: 0,
		enabled: true,
	},
	{
		id: "blocking",
		fieldType: "dependency",
		group: "dependencies",
		displayName: "Blocking",
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
	existingUserFields: any[]
): ModalFieldConfig[] {
	if (!existingUserFields || existingUserFields.length === 0) {
		return [];
	}

	return existingUserFields.map((userField, index) => ({
		id: userField.id || `user-${index}`,
		fieldType: "user" as const,
		group: "custom" as const,
		displayName: userField.displayName || `Field ${index + 1}`,
		visibleInCreation: true,
		visibleInEdit: true,
		order: index,
		enabled: true,
	}));
}

/**
 * Ensure person fields (creator/assignee) in userFields have matching entries in modalFieldsConfig.
 * Auto-repairs desync from migration edge cases or settings corruption.
 * Returns true if any entries were added.
 */
export function ensurePersonFieldsInModalConfig(settings: {
	modalFieldsConfig?: TaskModalFieldsConfig;
	userFields?: any[];
	creatorFieldName?: string;
	assigneeFieldName?: string;
}): boolean {
	if (!settings.modalFieldsConfig || !settings.userFields?.length) return false;

	const creatorKey = (settings.creatorFieldName || "creator").toLowerCase().replace(/s$/, "");
	const assigneeKey = (settings.assigneeFieldName || "assignee").toLowerCase().replace(/s$/, "");
	let changed = false;

	for (const userField of settings.userFields) {
		const key = (userField.key || "").toLowerCase().trim().replace(/s$/, "");
		if (!key) continue;

		const isPersonField = key === creatorKey || key === assigneeKey;
		if (!isPersonField) continue;

		const existsInConfig = settings.modalFieldsConfig.fields.some(
			(f) => f.id === userField.id
		);
		if (existsInConfig) continue;

		// Missing — add with full visibility
		const customGroupFields = settings.modalFieldsConfig.fields.filter(
			(f) => f.group === "custom"
		);
		const maxOrder = customGroupFields.length > 0
			? Math.max(...customGroupFields.map((f) => f.order))
			: -1;

		settings.modalFieldsConfig.fields.push({
			id: userField.id,
			fieldType: "user",
			group: "custom",
			displayName: userField.displayName || "",
			visibleInCreation: true,
			visibleInEdit: true,
			order: maxOrder + 1,
			enabled: true,
		});
		changed = true;
	}

	return changed;
}

/**
 * Initialize or migrate field configuration
 */
export function initializeFieldConfig(
	existingConfig?: TaskModalFieldsConfig,
	userFields?: any[]
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
