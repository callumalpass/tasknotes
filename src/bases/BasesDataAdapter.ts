import { BasesDataItem } from "./helpers";
import type {
	BasesEntry,
	BasesEntryGroup,
	BasesPropertyId,
	BasesView,
} from "obsidian";
import { createTaskNotesLogger, type TaskNotesLogger } from "../utils/tasknotesLogger";
import {
	convertBasesGroupKeyToString,
	convertBasesValueToNative,
} from "./basesValueConversion";
import { extractBasesEntryProperties } from "./basesEntryProperties";

type BasesViewDataSource = Pick<BasesView, "config" | "data">;

/**
 * Adapter for accessing Bases data using public API (1.10.0+).
 * Eliminates all internal API dependencies.
 */
export class BasesDataAdapter {
	private readonly logger: TaskNotesLogger;

	constructor(
		private basesView: BasesViewDataSource,
		logger: TaskNotesLogger = createTaskNotesLogger({ tag: "Bases/DataAdapter" })
	) {
		this.logger = logger;
	}

	/**
	 * Extract all data items from Bases query result.
	 * Uses public API: basesView.data.data
	 *
	 * NOTE: This only extracts frontmatter and basic file properties (cheap).
	 * Computed file properties (backlinks, links, etc.) are fetched lazily
	 * via getComputedProperty() during rendering for visible items only.
	 */
	extractDataItems(): BasesDataItem[] {
		const entries = this.basesView.data.data;
		return entries.map((entry) => ({
			key: entry.file.path,
			data: entry,
			file: entry.file,
			path: entry.file.path,
			properties: this.extractEntryProperties(entry),
			basesData: entry,
		}));
	}

	/**
	 * Get grouped data from Bases.
	 * Uses public API: basesView.data.groupedData
	 *
	 * Note: Returns pre-grouped data. Bases has already applied groupBy configuration.
	 */
	getGroupedData(): BasesEntryGroup[] {
		return this.basesView.data.groupedData;
	}

	/**
	 * Check if data is actually grouped (not just wrapped in single group).
	 *
	 * Note: When groupBy is configured but all items have the same value (or all null),
	 * groupedData will have length 1. We need to check hasKey() to distinguish between:
	 * - No groupBy configured: single group with no key (hasKey() = false)
	 * - GroupBy configured, all null: single group with NullValue key (hasKey() = false)
	 * - GroupBy configured, all same value: single group with value key (hasKey() = true)
	 *
	 * This means we cannot reliably detect "groupBy configured but all null" vs "no groupBy".
	 * Use getGroupedData() for actual rendering, as it always returns valid groups.
	 */
	isGrouped(): boolean {
		const groups = this.basesView.data.groupedData;
		if (groups.length !== 1) return true;

		const singleGroup = groups[0];
		return singleGroup.hasKey(); // False if key is null/undefined
	}

	/**
	 * Get sort configuration.
	 * Uses public API: basesView.config.getSort()
	 *
	 * Note: Data from basesView.data is already pre-sorted.
	 * This is only needed for custom sorting logic.
	 */
	getSortConfig() {
		return this.basesView.config.getSort();
	}

	/**
	 * Get visible property IDs.
	 * Uses public API: basesView.config.getOrder()
	 */
	getVisiblePropertyIds(): string[] {
		return this.basesView.config.getOrder();
	}

	/**
	 * Get display name for a property.
	 * Uses public API: basesView.config.getDisplayName()
	 */
	getPropertyDisplayName(propertyId: string): string {
		return this.basesView.config.getDisplayName(propertyId as BasesPropertyId);
	}

	/**
	 * Get property value from a Bases entry.
	 * Uses public API: entry.getValue()
	 */
	getPropertyValue(entry: BasesEntry, propertyId: string): unknown {
		try {
			const value = entry.getValue(propertyId as BasesPropertyId);
			return convertBasesValueToNative(value);
		} catch (e) {
			this.logger.warn("Failed to get property value", {
				category: "provider",
				operation: "get-property-value",
				details: { propertyId },
				error: e,
			});
			return null;
		}
	}

	/**
	 * Convert group key Value to display string.
	 * Handles Bases Value objects, particularly DateValue which has special structure.
	 * For FileValue (links), returns the file path which can be rendered as a clickable link.
	 */
	convertGroupKeyToString(key: unknown): string {
		return convertBasesGroupKeyToString(key);
	}

	/**
	 * Extract properties from a BasesEntry.
	 * Extracts frontmatter and basic file properties only (cheap operations).
	 * Computed file properties (backlinks, links, etc.) are fetched lazily via getComputedProperty().
	 */
	private extractEntryProperties(entry: BasesEntry): Record<string, unknown> {
		// NOTE: Computed file properties (links, embeds, tags, backlinks, etc.) are NOT extracted here.
		// They are fetched lazily via getComputedProperty() during rendering to avoid expensive
		// getValue() calls for all 6756+ entries. With virtualization, only ~20-50 visible items
		// need these properties computed.
		return extractBasesEntryProperties(entry);
	}

	/**
	 * Lazily get a computed file property from a BasesEntry.
	 * Call this during rendering for visible items only - NOT during bulk extraction.
	 * This is much more efficient for expensive properties like backlinks.
	 */
	getComputedProperty(basesEntry: unknown, propertyId: string): unknown {
		if (!basesEntry || typeof basesEntry !== "object") return null;

		try {
			const getValue = (basesEntry as { getValue?: (id: BasesPropertyId) => unknown })
				.getValue;
			if (typeof getValue !== "function") return null;
			const value = getValue.call(basesEntry, propertyId);
			return convertBasesValueToNative(value);
		} catch {
			return null;
		}
	}

}
