/**
 * Per-task field override utilities.
 *
 * Allows individual tasks to map custom frontmatter properties to core
 * fields (e.g., "deadline" → due, "owner" → assignee). Tracking properties
 * like `tnDueDateProp` are written to the task's frontmatter to record
 * these overrides.
 */

/**
 * Maps internal field keys to the frontmatter tracking property names
 * that record per-task overrides.
 *
 * Example: A task with `tnDueDateProp: "deadline"` in frontmatter
 * means "read/write the due date from the `deadline` property instead
 * of the default `due` property."
 */
export const FIELD_OVERRIDE_PROPS = {
	due: "tnDueDateProp",
	scheduled: "tnScheduledDateProp",
	completedDate: "tnCompletedDateProp",
	dateCreated: "tnCreatedDateProp",
	assignee: "tnAssigneeProp",
} as const;

/** Internal field keys that support per-task overrides. */
export type OverridableField = keyof typeof FIELD_OVERRIDE_PROPS;

/** All tracking property names (for use in skip/blocklists). */
export const TRACKING_PROP_NAMES = new Set(Object.values(FIELD_OVERRIDE_PROPS));

/** Human-readable labels for each overridable field. */
export const OVERRIDABLE_FIELD_LABELS: Record<OverridableField, string> = {
	due: "Due date",
	scheduled: "Scheduled date",
	completedDate: "Completed date",
	dateCreated: "Created date",
	assignee: "Assignee",
};

/** Expected property type for each overridable field. */
export const OVERRIDABLE_FIELD_TYPES: Record<OverridableField, string> = {
	due: "date",
	scheduled: "date",
	completedDate: "date",
	dateCreated: "date",
	assignee: "text",
};

/**
 * Editor type used when a mapped property's "Click to set..." is activated.
 * Controls which rich editor opens in Generate/Convert property rows.
 *
 * To add a new overridable field:
 * 1. Add entry to FIELD_OVERRIDE_PROPS (tracking prop name)
 * 2. Add entry to OVERRIDABLE_FIELD_LABELS (display name)
 * 3. Add entry to OVERRIDABLE_FIELD_TYPES (expected property type)
 * 4. Add entry here (editor behavior)
 * 5. Add entry to OVERRIDABLE_FIELD_PICKER_TITLES if using "date-picker"
 * 6. Add a case in BulkTaskCreationModal.renderCustomPropValueInput() for new editor types
 */
export type FieldEditorType = "date-picker" | "assignee-picker" | "inline";

export const OVERRIDABLE_FIELD_EDITORS: Record<OverridableField, FieldEditorType> = {
	due: "date-picker",
	scheduled: "date-picker",
	completedDate: "date-picker",
	dateCreated: "date-picker",
	assignee: "assignee-picker",
};

/** Picker title for date-picker editor type fields. */
export const OVERRIDABLE_FIELD_PICKER_TITLES: Partial<Record<OverridableField, string>> = {
	due: "Set due date",
	scheduled: "Set scheduled date",
	completedDate: "Set completed date",
	dateCreated: "Set created date",
};

/**
 * Read field overrides from a task's frontmatter.
 *
 * Scans for tracking properties (tnDueDateProp, etc.) and returns
 * a map of internal field key → custom property name.
 *
 * @example
 * // frontmatter: { tnDueDateProp: "deadline", tnScheduledDateProp: "review_date" }
 * readFieldOverrides(frontmatter)
 * // Returns: { due: "deadline", scheduled: "review_date" }
 */
export function readFieldOverrides(
	frontmatter: Record<string, any> | null | undefined
): Record<string, string> {
	if (!frontmatter) return {};

	const overrides: Record<string, string> = {};

	for (const [internalKey, trackingProp] of Object.entries(FIELD_OVERRIDE_PROPS)) {
		const customPropName = frontmatter[trackingProp];
		if (typeof customPropName === "string" && customPropName.trim()) {
			overrides[internalKey] = customPropName.trim();
		}
	}

	return overrides;
}

/**
 * Write field overrides to a frontmatter object.
 *
 * For each override, writes the tracking property (e.g., tnDueDateProp: "deadline").
 * Removes tracking properties for fields that are no longer overridden.
 *
 * @example
 * writeFieldOverrides(frontmatter, { due: "deadline" })
 * // Sets frontmatter.tnDueDateProp = "deadline"
 * // Deletes frontmatter.tnScheduledDateProp (if no scheduled override)
 */
export function writeFieldOverrides(
	frontmatter: Record<string, any>,
	overrides: Record<string, string>
): void {
	for (const [internalKey, trackingProp] of Object.entries(FIELD_OVERRIDE_PROPS)) {
		if (overrides[internalKey]) {
			frontmatter[trackingProp] = overrides[internalKey];
		} else {
			delete frontmatter[trackingProp];
		}
	}
}

/**
 * Resolve the actual frontmatter property name for a given internal field,
 * considering per-task overrides.
 *
 * @param internalKey - The internal field key (e.g., "due")
 * @param overrides - Per-task overrides from readFieldOverrides()
 * @param globalMapping - The global field name from FieldMapping (e.g., "due")
 * @returns The frontmatter property name to read/write
 */
export function resolveFieldName(
	internalKey: string,
	overrides: Record<string, string>,
	globalMapping: string
): string {
	return overrides[internalKey] || globalMapping;
}

/**
 * Resolve the frontmatter property name with an additional view-mapping
 * fallback layer. Resolution order:
 *   1. Per-task override (tnDueDateProp etc.)
 *   2. Per-view mapping (tnFieldMapping from .base file)
 *   3. Global mapping (settings)
 *
 * Use this when reading tasks in the context of a specific Bases view
 * so that tasks without tracking properties still resolve correctly.
 */
export function resolveFieldNameWithViewFallback(
	internalKey: string,
	overrides: Record<string, string>,
	viewMapping: Record<string, string> | undefined,
	globalMapping: string
): string {
	return overrides[internalKey] || viewMapping?.[internalKey] || globalMapping;
}
