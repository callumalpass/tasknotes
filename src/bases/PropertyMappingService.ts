import TaskNotesPlugin from "../main";
import { FieldMapper } from "../services/FieldMapper";
import type { FrontmatterPropertyName, TaskCardPropertyId } from "../types";

/**
 * PropertyMappingService - Centralized property name mapping for Bases integration
 *
 * This service handles the transformation of Bases column IDs to TaskCard property IDs.
 *
 * IMPORTANT CONCEPTS:
 * - Bases Column ID: The property identifier from Bases (e.g., "note.complete_instances", "file.name")
 * - Frontmatter Property Name: The actual YAML property (e.g., "complete_instances", "due")
 * - TaskCard Property ID: The identifier for extractors/renderers (usually same as frontmatter name)
 * - FieldMapping Key: The internal key in FieldMapping (e.g., "completeInstances")
 *
 * KEY PRINCIPLE: TaskCard extractors and renderers are keyed by frontmatter property names,
 * NOT by FieldMapping keys. So we must preserve the frontmatter property names through
 * the mapping chain.
 *
 * Example flow (user has default mapping: completeInstances="complete_instances"):
 * 1. Bases gives us: "note.complete_instances"
 * 2. Strip prefix: "complete_instances"
 * 3. Check if recognized: FieldMapper.isRecognizedProperty("complete_instances") → true
 * 4. Return: "complete_instances" (NOT "completeInstances")
 * 5. TaskCard uses PROPERTY_EXTRACTORS["complete_instances"] ✓
 *
 * Special transformations (for computed properties):
 * - "timeEntries" → "totalTrackedTime" (show total instead of raw array)
 * - "blockedBy" → "blocked" (show status pill instead of array)
 */
export class PropertyMappingService {
	constructor(
		private plugin: TaskNotesPlugin,
		private fieldMapper: FieldMapper
	) {}

	/**
	 * Map Bases property ID to TaskCard property ID.
	 *
	 * CRITICAL: Returns the frontmatter property name (or computed property name),
	 * NOT the FieldMapping key. TaskCard extractors/renderers are keyed by
	 * frontmatter property names.
	 *
	 * @param basesPropertyId - Property ID from Bases (e.g., "note.complete_instances", "file.name")
	 * @returns TaskCard property ID (e.g., "complete_instances", "title", "totalTrackedTime")
	 *
	 * @example
	 * // Default mapping: completeInstances = "complete_instances"
	 * basesToTaskCardProperty("note.complete_instances") // Returns: "complete_instances"
	 * basesToTaskCardProperty("complete_instances")      // Returns: "complete_instances"
	 * basesToTaskCardProperty("timeEntries")             // Returns: "totalTrackedTime" (special transformation)
	 */
	basesToTaskCardProperty(basesPropertyId: string): TaskCardPropertyId {
		// Step 1: Try custom field mapping on full ID first (edge case: user configured "note.state")
		if (this.fieldMapper) {
			if (this.fieldMapper.isRecognizedProperty(basesPropertyId)) {
				// Property is recognized, keep the original property name
				// (TaskCard extractors use frontmatter property names, not mapping keys)
				return this.applySpecialTransformations(basesPropertyId);
			}
		}

		// Step 2: Handle dotted prefixes - strip and check again
		if (basesPropertyId.startsWith("note.")) {
			const stripped = basesPropertyId.substring(5); // "note.complete_instances" → "complete_instances"

			// Try custom field mapping on stripped name (main case!)
			if (this.fieldMapper && this.fieldMapper.isRecognizedProperty(stripped)) {
				// Property is recognized, return the frontmatter property name
				return this.applySpecialTransformations(stripped);
			}

			// Handle known note properties
			if (stripped === "dateCreated") return "dateCreated";
			if (stripped === "dateModified") return "dateModified";
			if (stripped === "completedDate") return "completedDate";

			return this.applySpecialTransformations(stripped);
		}

		if (basesPropertyId.startsWith("task.")) {
			const stripped = basesPropertyId.substring(5);

			// Try custom field mapping on stripped name
			if (this.fieldMapper && this.fieldMapper.isRecognizedProperty(stripped)) {
				// Property is recognized, return the frontmatter property name
				return this.applySpecialTransformations(stripped);
			}

			return this.applySpecialTransformations(stripped);
		}

		if (basesPropertyId.startsWith("file.")) {
			// Map specific file properties to TaskInfo equivalents
			if (basesPropertyId === "file.ctime") return "dateCreated";
			if (basesPropertyId === "file.mtime") return "dateModified";

			// Keep file.* prefix for computed file properties (backlinks, links, etc.)
			// This distinguishes them from note.* properties with the same name
			return basesPropertyId;
		}

		// Step 3: Keep formula properties unchanged
		if (basesPropertyId.startsWith("formula.")) {
			return basesPropertyId;
		}

		// Step 4: Direct property (no prefix) - apply special transformations
		return this.applySpecialTransformations(basesPropertyId);
	}

	/**
	 * Map internal field name to user-configured property name.
	 * This is used when reading/writing frontmatter.
	 *
	 * @param internalFieldName - Internal field (e.g., "status")
	 * @returns User-configured property name (e.g., "task-status")
	 */
	internalToUserProperty(internalFieldName: string): string {
		// Check if this is a valid FieldMapping key
		const mapping = this.fieldMapper.getMapping();
		if (internalFieldName in mapping) {
			return this.fieldMapper.toUserField(internalFieldName as keyof typeof mapping);
		}
		// Not a FieldMapping key, return as-is
		return internalFieldName;
	}

	/**
	 * Map user-configured property name back to internal field name.
	 *
	 * @param userPropertyName - User's property name (e.g., "task-status")
	 * @returns Internal field name (e.g., "status")
	 */
	userPropertyToInternal(userPropertyName: string): string {
		return this.fieldMapper.fromUserField(userPropertyName) || userPropertyName;
	}

	/**
	 * Complete mapping: Bases property ID → User-configured property name.
	 * Use this when you need to read/write frontmatter based on Bases config.
	 */
	basesToUserProperty(basesPropertyId: string): string {
		const internal = this.basesToInternal(basesPropertyId);
		return this.internalToUserProperty(internal);
	}

	/**
	 * Apply TaskCard-specific property transformations.
	 * These are display-only transformations that don't affect data storage.
	 * Transforms calculated properties to their display representations.
	 */
	private applySpecialTransformations(propId: string): string {
		// timeEntries → totalTrackedTime (show computed total instead of raw array)
		if (propId === "timeEntries") return "totalTrackedTime";

		// blockedBy → blocked (show status pill instead of dependency array)
		if (propId === "blockedBy") return "blocked";

		// Keep everything else unchanged
		return propId;
	}

	/**
	 * Alias for basesToTaskCardProperty() for backward compatibility.
	 * @deprecated Use basesToTaskCardProperty() for clarity
	 */
	basesToInternal(basesPropertyId: string): string {
		return this.basesToTaskCardProperty(basesPropertyId);
	}

	/**
	 * Map Bases property ID to TaskInfo property name.
	 * This is used when calling updateTaskProperty() which expects TaskInfo keys.
	 *
	 * @param basesPropertyId - Property ID from Bases (e.g., "note.status", "status")
	 * @returns TaskInfo property name (e.g., "status", "priority", "due")
	 *
	 * @example
	 * // User has { status: "task-status" }
	 * basesToTaskInfoProperty("note.task-status") // Returns: "status"
	 * basesToTaskInfoProperty("task-status")      // Returns: "status"
	 */
	basesToTaskInfoProperty(basesPropertyId: string): string {
		// Strip Bases prefix
		let cleanId = basesPropertyId.replace(/^(note\.|file\.|task\.)/, '');

		// Try to map back from user-configured property name to internal field name
		const internalField = this.fieldMapper?.fromUserField(cleanId);
		if (internalField) {
			return internalField;
		}

		// Handle special mappings
		if (cleanId === "ctime" || basesPropertyId === "file.ctime") return "dateCreated";
		if (cleanId === "mtime" || basesPropertyId === "file.mtime") return "dateModified";
		if (cleanId === "name" || cleanId === "basename") return "title";

		// Return as-is for unknown properties
		return cleanId;
	}

	/**
	 * Map a list of Bases property IDs to TaskCard property IDs.
	 * Simply maps each property - no filtering.
	 * If a property is in the Bases config, it will be shown.
	 *
	 * @param basesPropertyIds - Property IDs from Bases config
	 * @returns TaskCard property IDs for rendering
	 */
	mapVisibleProperties(basesPropertyIds: string[]): TaskCardPropertyId[] {
		return basesPropertyIds.map((id) => this.basesToTaskCardProperty(id));
	}
}
