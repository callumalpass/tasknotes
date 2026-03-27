/**
 * PersonNoteService - Reads preferences from person notes
 *
 * Person notes have `type: person` in frontmatter and can include
 * notification preferences like availability windows and reminderLeadTimes.
 *
 * Features:
 * - Reads person preferences from frontmatter
 * - Caches preferences for performance
 * - Provides defaults when preferences are not set
 * - Backwards-compatible: reads legacy `reminderTime` as `availableFrom`
 */

import { TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { PersonPreferences, LeadTime } from "../types/settings";

// Re-export types for convenience
export type { PersonPreferences, LeadTime } from "../types/settings";

/**
 * Default preferences for person notes without explicit configuration.
 */
export const DEFAULT_PERSON_PREFERENCES: PersonPreferences = {
	availableFrom: "09:00",
	availableUntil: "17:00",
	reminderLeadTimes: [
		{ value: 1, unit: "days" },
		{ value: 15, unit: "minutes" },
	],
	notificationEnabled: true,
	overrideGlobalReminders: true,
};

export class PersonNoteService {
	private plugin: TaskNotesPlugin;
	private preferencesCache: Map<string, PersonPreferences> = new Map();

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get preferences for a person note.
	 * Returns cached value if available, otherwise reads from file.
	 */
	getPreferences(personPath: string): PersonPreferences {
		// Check cache first
		const cached = this.preferencesCache.get(personPath);
		if (cached) {
			return cached;
		}

		// Read from file
		const preferences = this.readPreferencesFromFile(personPath);
		this.preferencesCache.set(personPath, preferences);
		return preferences;
	}

	/**
	 * Read preferences from a person note's frontmatter.
	 */
	private readPreferencesFromFile(personPath: string): PersonPreferences {
		// Two-step file lookup (same as avatar handler in settings)
		let file = this.plugin.app.vault.getAbstractFileByPath(personPath);
		if (!file) {
			const linkPath = personPath.replace(/\.md$/, "");
			file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, "");
		}
		if (!(file instanceof TFile)) {
			console.debug(`[PersonNoteService] File not found for path: "${personPath}" — using defaults`);
			return { ...DEFAULT_PERSON_PREFERENCES };
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;

		if (!fm) {
			console.debug(`[PersonNoteService] No frontmatter for: "${personPath}" — using defaults`);
			return { ...DEFAULT_PERSON_PREFERENCES };
		}

		// Build preferences from frontmatter with defaults
		// Backwards compat: read availableFrom, fall back to legacy reminderTime
		const availableFrom = fm.availableFrom !== undefined
			? this.parseTimeField(fm.availableFrom, DEFAULT_PERSON_PREFERENCES.availableFrom)
			: fm.reminderTime !== undefined
				? this.parseTimeField(fm.reminderTime, DEFAULT_PERSON_PREFERENCES.availableFrom)
				: DEFAULT_PERSON_PREFERENCES.availableFrom;

		const preferences: PersonPreferences = {
			availableFrom,
			availableUntil: this.parseTimeField(fm.availableUntil, DEFAULT_PERSON_PREFERENCES.availableUntil),
			reminderLeadTimes: this.parseLeadTimes(fm.reminderLeadTimes),
			notificationEnabled: this.parseBoolean(
				fm.notificationEnabled,
				DEFAULT_PERSON_PREFERENCES.notificationEnabled
			),
			overrideGlobalReminders: this.parseBoolean(
				fm.overrideGlobalReminders,
				DEFAULT_PERSON_PREFERENCES.overrideGlobalReminders
			),
		};

		return preferences;
	}

	/**
	 * Parse a time field from frontmatter.
	 * Expects "HH:MM" format. Obsidian's YAML parser may convert bare HH:MM
	 * values to sexagesimal numbers (e.g., 08:30 → 510), so we handle both
	 * string and number inputs.
	 */
	private parseTimeField(value: unknown, defaultValue: string): string {
		if (typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value)) {
			return value;
		}
		// Obsidian YAML parses bare HH:MM as sexagesimal number (H*60+M)
		if (typeof value === "number" && value >= 0 && value <= 1439) {
			const hours = Math.floor(value / 60);
			const minutes = value % 60;
			return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
		}
		return defaultValue;
	}

	/**
	 * Parse reminderLeadTimes from frontmatter.
	 * Expects array of { value: number, unit: string }.
	 */
	private parseLeadTimes(value: unknown): LeadTime[] {
		if (!Array.isArray(value)) {
			return [...DEFAULT_PERSON_PREFERENCES.reminderLeadTimes];
		}

		const validUnits = ["minutes", "hours", "days", "weeks"];
		const leadTimes: LeadTime[] = [];

		for (const item of value) {
			if (
				typeof item === "object" &&
				item !== null &&
				typeof item.value === "number" &&
				typeof item.unit === "string" &&
				validUnits.includes(item.unit)
			) {
				leadTimes.push({
					value: item.value,
					unit: item.unit as LeadTime["unit"],
				});
			}
		}

		return leadTimes.length > 0
			? leadTimes
			: [...DEFAULT_PERSON_PREFERENCES.reminderLeadTimes];
	}

	/**
	 * Parse a boolean value with a default.
	 */
	private parseBoolean(value: unknown, defaultValue: boolean): boolean {
		if (typeof value === "boolean") {
			return value;
		}
		if (value === "true") return true;
		if (value === "false") return false;
		return defaultValue;
	}

	/**
	 * Invalidate cached preferences for a path.
	 * Call this when a person note is modified.
	 */
	invalidateCache(path: string): void {
		this.preferencesCache.delete(path);
	}

	/**
	 * Clear all cached preferences.
	 */
	clearCache(): void {
		this.preferencesCache.clear();
	}

	/**
	 * Get the availability start time for a person.
	 * Day+ reminders are pinned to this time.
	 */
	getAvailableFrom(personPath: string): { hours: number; minutes: number } {
		const prefs = this.getPreferences(personPath);
		const [hours, minutes] = prefs.availableFrom.split(":").map(Number);
		return {
			hours: isNaN(hours) ? 9 : hours,
			minutes: isNaN(minutes) ? 0 : minutes,
		};
	}

	/**
	 * Get the availability end time for a person.
	 * Reminders outside the window may be deferred to the next availableFrom.
	 */
	getAvailableUntil(personPath: string): { hours: number; minutes: number } {
		const prefs = this.getPreferences(personPath);
		const [hours, minutes] = prefs.availableUntil.split(":").map(Number);
		return {
			hours: isNaN(hours) ? 17 : hours,
			minutes: isNaN(minutes) ? 0 : minutes,
		};
	}

	/**
	 * Check if notifications are enabled for a person.
	 */
	isNotificationEnabled(personPath: string): boolean {
		return this.getPreferences(personPath).notificationEnabled;
	}

	/**
	 * Check if a person's reminders should override global lead-time rules.
	 * true = replace global rules, false = add to them.
	 */
	shouldOverrideGlobal(personPath: string): boolean {
		return this.getPreferences(personPath).overrideGlobalReminders;
	}

	/**
	 * Convert lead times to milliseconds for a specific person.
	 * Returns an array of millisecond values.
	 */
	getLeadTimesInMs(personPath: string): number[] {
		const prefs = this.getPreferences(personPath);
		return prefs.reminderLeadTimes.map((lt) => this.leadTimeToMs(lt));
	}

	/**
	 * Convert a single lead time to milliseconds.
	 */
	private leadTimeToMs(leadTime: LeadTime): number {
		const multipliers: Record<LeadTime["unit"], number> = {
			minutes: 60 * 1000,
			hours: 60 * 60 * 1000,
			days: 24 * 60 * 60 * 1000,
			weeks: 7 * 24 * 60 * 60 * 1000,
		};
		return leadTime.value * multipliers[leadTime.unit];
	}

	/**
	 * Convert a LeadTime to a negative ISO 8601 duration string.
	 * Bridges person note format to Reminder.offset format.
	 * Examples: { value: 1, unit: "days" } → "-P1D"
	 *           { value: 15, unit: "minutes" } → "-PT15M"
	 *           { value: 2, unit: "hours" } → "-PT2H"
	 *           { value: 1, unit: "weeks" } → "-P1W"
	 */
	leadTimeToISO8601(leadTime: LeadTime): string {
		const needsT = leadTime.unit === "minutes" || leadTime.unit === "hours";
		const unitMap: Record<LeadTime["unit"], string> = {
			minutes: "M",
			hours: "H",
			days: "D",
			weeks: "W",
		};
		return `-P${needsT ? "T" : ""}${leadTime.value}${unitMap[leadTime.unit]}`;
	}

	/**
	 * Check if a person note explicitly declares custom reminderLeadTimes.
	 * Returns false if the field is missing, not an array, or empty.
	 * This distinguishes "person set lead times" from "using defaults".
	 */
	hasCustomLeadTimes(personPath: string): boolean {
		// Two-step file lookup (same as readPreferencesFromFile)
		let file = this.plugin.app.vault.getAbstractFileByPath(personPath);
		if (!file) {
			const linkPath = personPath.replace(/\.md$/, "");
			file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, "");
		}
		if (!(file instanceof TFile)) return false;
		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		return fm ? Array.isArray(fm.reminderLeadTimes) && fm.reminderLeadTimes.length > 0 : false;
	}

	/**
	 * Discover all person notes in the vault.
	 * Looks for notes with `type: person` in frontmatter.
	 * Respects personNotesFolder and personNotesTag settings.
	 */
	discoverPersons(): PersonNoteInfo[] {
		const folder = this.plugin.settings.personNotesFolder || "";
		const tag = this.plugin.settings.personNotesTag || "";
		const persons: PersonNoteInfo[] = [];

		const files = this.plugin.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Check folder filter
			if (folder && !file.path.startsWith(folder)) {
				continue;
			}

			// Check if it's a person note
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter;

			// Check if it's a person note using configurable property name and value
			const typeProperty = this.plugin.settings.identityTypePropertyName || "type";
			const personValue = this.plugin.settings.personTypeValue || "person";
			if (!frontmatter || frontmatter[typeProperty] !== personValue) {
				continue;
			}

			// Check optional tag filter
			if (tag) {
				const fmTags = frontmatter.tags;
				const hasFmTag = Array.isArray(fmTags)
					? fmTags.some((t: string) => t === tag || t === `#${tag}`)
					: typeof fmTags === "string" && (fmTags === tag || fmTags === `#${tag}`);

				const inlineTags = cache.tags?.map((t) => t.tag.replace(/^#/, "")) || [];
				const hasInlineTag = inlineTags.includes(tag);

				if (!hasFmTag && !hasInlineTag) {
					continue;
				}
			}

			// Get display name from title field or filename
			const titleField = this.plugin.fieldMapper.toUserField("title");
			const displayName = frontmatter[titleField] || file.basename;

			persons.push({
				path: file.path,
				displayName,
				role: frontmatter.role,
				department: frontmatter.department,
			});
		}

		return persons;
	}
}

/**
 * Information about a discovered person note.
 */
export interface PersonNoteInfo {
	path: string;
	displayName: string;
	role?: string;
	department?: string;
}
