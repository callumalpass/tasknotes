import type { App } from "obsidian";
import { describe, expect, it } from "@jest/globals";
import {
	coerceGroupKeyForFrontmatter,
	coerceGroupKeyToPropertyType,
	getPropertyTypeForFrontmatterKey,
} from "../../../src/bases/propertyValueCoercion";

describe("Issue #944: Custom field type preservation on grouped drag-and-drop", () => {
	describe("number fields", () => {
		it("coerces numeric column keys back to numbers", () => {
			expect(coerceGroupKeyToPropertyType("2", "number")).toBe(2);
			expect(coerceGroupKeyToPropertyType("-2", "number")).toBe(-2);
			expect(coerceGroupKeyToPropertyType("1.5", "number")).toBe(1.5);
		});

		it("leaves non-numeric values unchanged for number fields", () => {
			expect(coerceGroupKeyToPropertyType("2a", "number")).toBe("2a");
			expect(coerceGroupKeyToPropertyType("None", "number")).toBe("None");
		});
	});

	describe("boolean fields", () => {
		it("coerces TaskNotes boolean field columns back to booleans", () => {
			expect(coerceGroupKeyToPropertyType("True", "boolean")).toBe(true);
			expect(coerceGroupKeyToPropertyType("False", "boolean")).toBe(false);
		});

		it("coerces Obsidian checkbox field columns back to booleans", () => {
			expect(coerceGroupKeyToPropertyType("true", "checkbox")).toBe(true);
			expect(coerceGroupKeyToPropertyType("false", "checkbox")).toBe(false);
		});
	});

	describe("string fields", () => {
		it("keeps text, date, and list group keys as strings", () => {
			expect(coerceGroupKeyToPropertyType("In Progress", "text")).toBe("In Progress");
			expect(coerceGroupKeyToPropertyType("2026-05-18", "date")).toBe("2026-05-18");
			expect(coerceGroupKeyToPropertyType("work", "list")).toBe("work");
		});
	});

	describe("type lookup", () => {
		const app = {
			metadataTypeManager: {
				properties: {
					archived: { type: "checkbox" },
					sprint: { type: "text" },
				},
			},
		} as unknown as App;

		it("prefers TaskNotes user field types over Obsidian metadata hints", () => {
			const userFields = [{ key: "sprint", type: "number" as const }];

			expect(getPropertyTypeForFrontmatterKey(app, "sprint", userFields)).toBe("number");
			expect(coerceGroupKeyForFrontmatter(app, "sprint", "2", userFields)).toBe(2);
		});

		it("uses Obsidian metadata type hints when a TaskNotes user field is not configured", () => {
			expect(getPropertyTypeForFrontmatterKey(app, "archived", [])).toBe("checkbox");
			expect(coerceGroupKeyForFrontmatter(app, "archived", "True", [])).toBe(true);
		});
	});
});
