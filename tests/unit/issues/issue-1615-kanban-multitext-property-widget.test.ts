/**
 * Regression coverage for Issue #1615: Kanban custom multi-text properties not
 * detected as list (metadataTypeManager uses .widget not .type)
 *
 * When grouping Kanban by a custom list/multi-text property with "Show items
 * in multiple columns" enabled, tasks do not split into multiple columns.
 * The bug is in isListTypeProperty() which reads propertyInfo.type, but
 * Obsidian's metadataTypeManager exposes the field as propertyInfo.widget.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1615
 */

import { describe, it, expect } from "@jest/globals";
import type { App } from "obsidian";
import { isObsidianListProperty } from "../../../src/bases/basesViewAdapters";

interface PropertyInfo {
	name: string;
	type?: string;
	widget?: string;
	occurrences?: number;
}

/**
 * Simulates the buggy isListTypeProperty() from KanbanView.ts lines ~437-466.
 * Only checks propertyInfo.type, missing propertyInfo.widget.
 */
function isListTypePropertyBuggy(
	propertyName: string,
	properties: Record<string, PropertyInfo>
): boolean {
	const propertyInfo = properties[propertyName.toLowerCase()];
	if (propertyInfo?.type) {
		const listTypes = new Set(["multitext", "tags", "aliases"]);
		if (listTypes.has(propertyInfo.type)) {
			return true;
		}
	}

	// Fallback: known TaskNotes list properties
	const knownListProperties = new Set(["contexts", "projects", "tags", "aliases"]);
	return knownListProperties.has(propertyName);
}

describe("Issue #1615: Kanban custom multitext property detection", () => {
	// Simulates what Obsidian's metadataTypeManager actually returns
	const obsidianProperties: Record<string, PropertyInfo> = {
		anchors: { name: "anchors", widget: "multitext", occurrences: 11 },
		mycustomtags: { name: "mycustomtags", widget: "multitext", occurrences: 5 },
		// Built-in properties that may have .type instead of .widget
		tags: { name: "tags", type: "tags", occurrences: 100 },
	};

	it.skip("reproduces issue #1615 - custom multitext with .widget not detected", () => {
		// BUG: custom "anchors" property has .widget="multitext" but not .type
		// isListTypePropertyBuggy checks .type, which is undefined, so it falls
		// through to the fallback set which doesn't include "anchors"
		expect(isListTypePropertyBuggy("anchors", obsidianProperties)).toBe(false);

		// Built-in "tags" works because it's in the hardcoded fallback set
		expect(isListTypePropertyBuggy("tags", obsidianProperties)).toBe(true);
	});

	it("detects custom multitext properties exposed through metadataTypeManager.widget", () => {
		const app = {
			metadataTypeManager: {
				properties: obsidianProperties,
			},
		} as unknown as App;

		expect(isObsidianListProperty(app, "anchors")).toBe(true);
		expect(isObsidianListProperty(app, "mycustomtags")).toBe(true);
		expect(isObsidianListProperty(app, "tags")).toBe(true);
	});

	it("does not treat non-list widget metadata as list properties", () => {
		const app = {
			metadataTypeManager: {
				properties: {
					description: { name: "description", widget: "text", occurrences: 50 },
					count: { name: "count", widget: "number", occurrences: 10 },
				},
			},
		} as unknown as App;

		expect(isObsidianListProperty(app, "description")).toBe(false);
		expect(isObsidianListProperty(app, "count")).toBe(false);
	});
});
