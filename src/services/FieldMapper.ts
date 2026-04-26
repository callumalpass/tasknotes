/* eslint-disable no-console */
import { FieldMapping, TaskInfo } from "../types";
import type { UserMappedField } from "../types/settings";
import {
	isPropertyForField,
	isRecognizedProperty,
	lookupMappingKey,
	mapTaskFromFrontmatter,
	mapTaskToFrontmatter,
	toUserField,
	toUserFields,
	validateFieldMapping,
} from "../core/fieldMapping";

/**
 * Service for mapping between internal field names and user-configured property names
 */
export class FieldMapper {
	constructor(
		private mapping: FieldMapping,
		private userFields: UserMappedField[] = []
	) {}

	/**
	 * Update user-defined field definitions (call when settings change)
	 */
	updateUserFields(fields: UserMappedField[]): void {
		this.userFields = fields;
	}

	/**
	 * Get current user-defined field definitions
	 */
	getUserFields(): UserMappedField[] {
		return [...this.userFields];
	}

	/**
	 * Convert internal field name to user's property name
	 */
	toUserField(internalName: keyof FieldMapping): string {
		return toUserField(this.mapping, internalName);
	}

	/**
	 * Convert frontmatter object using mapping to internal task data.
	 * User-defined fields (settings.userFields) are written as top-level properties
	 * on the returned object, keyed by their frontmatter key (e.g. "start_date").
	 */
	mapFromFrontmatter(
		frontmatter: any,
		filePath: string,
		storeTitleInFilename?: boolean
	): Partial<TaskInfo> {
		return mapTaskFromFrontmatter(this.mapping, frontmatter, filePath, storeTitleInFilename, this.userFields);
	}

	/**
	 * Convert internal task data to frontmatter using mapping.
	 * User-defined fields are read from top-level task properties and written
	 * back to frontmatter using each field's configured frontmatter key.
	 */
	mapToFrontmatter(
		taskData: Partial<TaskInfo>,
		taskTag?: string,
		storeTitleInFilename?: boolean
	): any {
		return mapTaskToFrontmatter(this.mapping, taskData, taskTag, storeTitleInFilename, this.userFields);
	}

	/**
	 * Update mapping configuration
	 */
	updateMapping(newMapping: FieldMapping): void {
		this.mapping = newMapping;
	}

	/**
	 * Get current mapping
	 */
	getMapping(): FieldMapping {
		return { ...this.mapping };
	}

	/**
	 * Look up the FieldMapping key for a given frontmatter property name.
	 *
	 * IMPORTANT: This returns the MAPPING KEY (e.g., "completeInstances"),
	 * NOT the frontmatter property name (e.g., "complete_instances").
	 *
	 * Use this to check if a property is recognized/mapped, but DO NOT use
	 * the returned key directly as a property identifier for TaskCard.
	 *
	 * @param frontmatterPropertyName - The property name from YAML (e.g., "complete_instances")
	 * @returns The FieldMapping key (e.g., "completeInstances") or null if not found
	 *
	 * @example
	 * // Given mapping: { completeInstances: "complete_instances" }
	 * lookupMappingKey("complete_instances") // Returns: "completeInstances"
	 * lookupMappingKey("unknown_field")      // Returns: null
	 */
	lookupMappingKey(frontmatterPropertyName: string): keyof FieldMapping | null {
		return lookupMappingKey(this.mapping, frontmatterPropertyName);
	}

	/**
	 * Check if a frontmatter property name is a recognized/configured field.
	 * Returns true if the property has a mapping, false otherwise.
	 *
	 * @param frontmatterPropertyName - The property name from YAML
	 * @returns true if the property is recognized, false otherwise
	 */
	isRecognizedProperty(frontmatterPropertyName: string): boolean {
		return isRecognizedProperty(this.mapping, frontmatterPropertyName);
	}

	/**
	 * Check if a property name matches a specific internal field.
	 * This handles user-configured field names properly.
	 *
	 * @param propertyName - The property name to check (could be user-configured or internal)
	 * @param internalField - The internal field key to check against
	 * @returns true if the propertyName is the user's configured name for this field
	 *
	 * @example
	 * // User has { status: "task-status" }
	 * isPropertyForField("task-status", "status") // true
	 * isPropertyForField("status", "status")      // false
	 *
	 * // User has { status: "status" } (default)
	 * isPropertyForField("status", "status")      // true
	 */
	isPropertyForField(propertyName: string, internalField: keyof FieldMapping): boolean {
		return isPropertyForField(this.mapping, propertyName, internalField);
	}

	/**
	 * Convert an array of internal field names to their user-configured property names.
	 *
	 * @param internalFields - Array of FieldMapping keys
	 * @returns Array of user-configured property names
	 *
	 * @example
	 * // User has { status: "task-status", due: "deadline" }
	 * toUserFields(["status", "due", "priority"])
	 * // Returns: ["task-status", "deadline", "priority"]
	 */
	toUserFields(internalFields: (keyof FieldMapping)[]): string[] {
		return toUserFields(this.mapping, internalFields);
	}

	/**
	 * @deprecated Use lookupMappingKey() instead for clarity about what is returned
	 * Convert user's property name back to internal field name
	 * This is the reverse of toUserField()
	 */
	fromUserField(userPropertyName: string): keyof FieldMapping | null {
		return this.lookupMappingKey(userPropertyName);
	}

	/**
	 * Validate that a mapping has no empty field names
	 */
	static validateMapping(mapping: FieldMapping): { valid: boolean; errors: string[] } {
		return validateFieldMapping(mapping);
	}
}
