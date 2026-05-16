import { PropertyTriggerConfig, NLPTriggersConfig, UserMappedField } from "../types/settings";

/**
 * Service for managing and querying NLP trigger configurations
 */
export class TriggerConfigService {
	private config: NLPTriggersConfig;
	private userFields: UserMappedField[];

	// Cache for quick lookups
	private triggerMap: Map<string, PropertyTriggerConfig>; // trigger -> config
	private propertyMap: Map<string, PropertyTriggerConfig>; // propertyId -> config

	constructor(config: NLPTriggersConfig, userFields: UserMappedField[] = []) {
		this.config = config;
		this.userFields = userFields;
		this.triggerMap = new Map();
		this.propertyMap = new Map();
		this.buildMaps();
	}

	/**
	 * Build lookup maps for efficient queries
	 */
	private buildMaps(): void {
		this.triggerMap.clear();
		this.propertyMap.clear();

		for (const triggerConfig of this.config.triggers) {
			if (triggerConfig.enabled) {
				this.triggerMap.set(triggerConfig.trigger, triggerConfig);
				this.propertyMap.set(triggerConfig.propertyId, triggerConfig);
			}
		}
	}

	/**
	 * Get trigger config for a specific property
	 */
	getTriggerForProperty(propertyId: string): PropertyTriggerConfig | undefined {
		return this.propertyMap.get(propertyId);
	}

	/**
	 * Get property ID for a trigger string
	 */
	getPropertyForTrigger(trigger: string): string | undefined {
		return this.triggerMap.get(trigger)?.propertyId;
	}

	/**
	 * Get all enabled triggers
	 */
	getAllEnabledTriggers(): PropertyTriggerConfig[] {
		return this.config.triggers.filter((t) => t.enabled);
	}

	/**
	 * Get all enabled triggers sorted by trigger length (longest first)
	 * This ensures multi-character triggers are matched before single-character ones
	 */
	getTriggersOrderedByLength(): PropertyTriggerConfig[] {
		return this.getAllEnabledTriggers().sort((a, b) => b.trigger.length - a.trigger.length);
	}

	/**
	 * Check if a trigger is using Obsidian's native tag suggester
	 */
	usesNativeTagSuggester(): boolean {
		const tagTrigger = this.getTriggerForProperty("tags");
		return tagTrigger?.trigger === "#" && tagTrigger?.enabled;
	}

	/**
	 * Get the trigger string for tags (or undefined if disabled)
	 */
	getTagTrigger(): string | undefined {
		const config = this.getTriggerForProperty("tags");
		return config?.enabled ? config.trigger : undefined;
	}

	/**
	 * Get the trigger string for contexts (or undefined if disabled)
	 */
	getContextTrigger(): string | undefined {
		const config = this.getTriggerForProperty("contexts");
		return config?.enabled ? config.trigger : undefined;
	}

	/**
	 * Get the trigger string for projects (or undefined if disabled)
	 */
	getProjectTrigger(): string | undefined {
		const config = this.getTriggerForProperty("projects");
		return config?.enabled ? config.trigger : undefined;
	}

	/**
	 * Get the trigger string for status (or undefined if disabled)
	 */
	getStatusTrigger(): string | undefined {
		const config = this.getTriggerForProperty("status");
		return config?.enabled ? config.trigger : undefined;
	}

	/**
	 * Get the trigger string for priority (or undefined if disabled)
	 */
	getPriorityTrigger(): string | undefined {
		const config = this.getTriggerForProperty("priority");
		return config?.enabled ? config.trigger : undefined;
	}

	/**
	 * Get user field definition by ID
	 */
	getUserField(fieldId: string): UserMappedField | undefined {
		return this.userFields.find((f) => f.id === fieldId);
	}

	/**
	 * Check if a property ID is a user-defined field
	 */
	isUserField(propertyId: string): boolean {
		return this.userFields.some((f) => f.id === propertyId);
	}

	/**
	 * Determine suggester type for a property
	 */
	getSuggesterType(
		propertyId: string
	): "list" | "file" | "status" | "priority" | "native-tag" | "boolean" | "none" {
		// Built-in property types
		if (propertyId === "tags") {
			return this.usesNativeTagSuggester() ? "native-tag" : "list";
		}
		if (propertyId === "contexts") return "list";
		if (propertyId === "projects") return "file";
		if (propertyId === "status") return "status";
		if (propertyId === "priority") return "priority";

		// User-defined fields
		const userField = this.getUserField(propertyId);
		if (userField) {
			switch (userField.type) {
				case "text":
				case "list":
					// If it has autosuggest config, use file suggester
					return userField.autosuggestFilter ? "file" : "list";
				case "boolean":
					return "boolean";
				default:
					return "none";
			}
		}

		return "none";
	}

	/**
	 * Update the configuration (rebuilds internal maps)
	 */
	updateConfig(config: NLPTriggersConfig): void {
		this.config = config;
		this.buildMaps();
	}

	/**
	 * Update user fields (rebuilds internal maps if needed)
	 */
	updateUserFields(userFields: UserMappedField[]): void {
		this.userFields = userFields;
		// User fields don't affect trigger map, but we might want to rebuild in the future
	}
}
