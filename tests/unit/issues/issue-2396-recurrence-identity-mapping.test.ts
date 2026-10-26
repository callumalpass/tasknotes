import { FieldMapper } from "../../../src/core/FieldMapper";
import {
	isRecognizedProperty,
	lookupMappingKey,
	mapTaskFromFrontmatter,
	mapTaskToFrontmatter,
	normalizeRecurrenceOriginalDate,
	toUserField,
	validateFieldMapping,
} from "../../../src/core/fieldMapping";
import { buildCalendarDataSignaturePropertyIds } from "../../../src/bases/calendarDataSignature";
import { createTaskInfoFromBasesData } from "../../../src/bases/helpers";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import type { FieldMapping } from "../../../src/types";
import type TaskNotesPlugin from "../../../src/main";

// Settings saved before recurrenceOriginalDate existed do not contain the key.
function legacyMapping(): FieldMapping {
	const legacy: Partial<FieldMapping> = { ...DEFAULT_FIELD_MAPPING };
	delete legacy.recurrenceOriginalDate;
	return legacy as FieldMapping;
}

describe("issue #2396 recurrence_original_date mapping", () => {
	it("defaults to the recurrence_original_date property", () => {
		expect(DEFAULT_FIELD_MAPPING.recurrenceOriginalDate).toBe("recurrence_original_date");
	});

	it("round-trips the original rule date through default and custom property names", () => {
		const custom = { ...DEFAULT_FIELD_MAPPING, recurrenceOriginalDate: "moved_from" };

		expect(
			mapTaskToFrontmatter(DEFAULT_FIELD_MAPPING, { recurrence_original_date: "2026-03-04" })
		).toMatchObject({ recurrence_original_date: "2026-03-04" });
		expect(
			mapTaskFromFrontmatter(DEFAULT_FIELD_MAPPING, { recurrence_original_date: "2026-03-04" }, "t.md")
		).toMatchObject({ recurrence_original_date: "2026-03-04" });

		const written = mapTaskToFrontmatter(custom, { recurrence_original_date: "2026-03-04" });
		expect(written).toMatchObject({ moved_from: "2026-03-04" });
		expect(written).not.toHaveProperty("recurrence_original_date");
		expect(
			mapTaskFromFrontmatter(custom, { moved_from: "2026-03-04" }, "t.md")
		).toMatchObject({ recurrence_original_date: "2026-03-04" });
	});

	it("falls back to the default property name for settings saved without the key", () => {
		const mapping = legacyMapping();

		expect(toUserField(mapping, "recurrenceOriginalDate")).toBe("recurrence_original_date");
		expect(lookupMappingKey(mapping, "recurrence_original_date")).toBe("recurrenceOriginalDate");
		expect(isRecognizedProperty(mapping, "recurrence_original_date")).toBe(true);
		expect(validateFieldMapping(mapping)).toEqual({ valid: true, errors: [] });
		expect(
			mapTaskToFrontmatter(mapping, { recurrence_original_date: "2026-03-04" })
		).toMatchObject({ recurrence_original_date: "2026-03-04" });
		expect(
			mapTaskFromFrontmatter(mapping, { recurrence_original_date: "2026-03-04" }, "t.md")
		).toMatchObject({ recurrence_original_date: "2026-03-04" });

		const mapper = new FieldMapper(mapping);
		expect(mapper.toUserField("recurrenceOriginalDate")).toBe("recurrence_original_date");
		expect(mapper.isPropertyForField("recurrence_original_date", "recurrenceOriginalDate")).toBe(
			true
		);
	});

	it("rejects malformed values on read and write", () => {
		for (const bad of [
			"2026-02-30",
			"2026-3-4",
			"2026-03-04T10:00:00",
			"not a date",
			"",
			20260304,
			["2026-03-04"],
			null,
		]) {
			expect(normalizeRecurrenceOriginalDate(bad)).toBeUndefined();
			expect(
				mapTaskFromFrontmatter(DEFAULT_FIELD_MAPPING, { recurrence_original_date: bad }, "t.md")
			).not.toHaveProperty("recurrence_original_date");
			expect(
				mapTaskToFrontmatter(DEFAULT_FIELD_MAPPING, {
					recurrence_original_date: bad as string,
				})
			).not.toHaveProperty("recurrence_original_date");
		}
		expect(normalizeRecurrenceOriginalDate(" 2026-03-04 ")).toBe("2026-03-04");
	});

	it("rejects a custom property name that collides with another mapped field", () => {
		const result = validateFieldMapping({
			...DEFAULT_FIELD_MAPPING,
			recurrenceOriginalDate: DEFAULT_FIELD_MAPPING.occurrenceDate,
		});
		expect(result.valid).toBe(false);
	});

	it("includes the mapped property in the calendar data signature", () => {
		const mapField = (field: keyof FieldMapping) =>
			field === "recurrenceOriginalDate" ? "moved_from" : DEFAULT_FIELD_MAPPING[field];
		expect(
			buildCalendarDataSignaturePropertyIds({ mapField, showPropertyBasedEvents: false })
		).toContain("moved_from");
		expect(
			buildCalendarDataSignaturePropertyIds({
				mapField: () => undefined,
				showPropertyBasedEvents: false,
			})
		).toContain("recurrence_original_date");
	});

	it("exposes the original date on Bases task info only when it is valid", () => {
		const plugin = {
			fieldMapper: new FieldMapper({ ...DEFAULT_FIELD_MAPPING, recurrenceOriginalDate: "moved_from" }),
			settings: { defaultTaskStatus: "open", storeTitleInFilename: false },
			dependencyCache: undefined,
			cacheManager: { getCachedTaskInfoSync: jest.fn() },
		} as unknown as TaskNotesPlugin;

		const valid = createTaskInfoFromBasesData(
			{ path: "Tasks/A.md", properties: { title: "A", moved_from: "2026-03-04" } },
			plugin
		);
		expect(valid?.recurrence_original_date).toBe("2026-03-04");
		expect(valid?.customProperties ?? {}).not.toHaveProperty("moved_from");

		const invalid = createTaskInfoFromBasesData(
			{ path: "Tasks/A.md", properties: { title: "A", moved_from: "2026-02-30" } },
			plugin
		);
		expect(invalid?.recurrence_original_date).toBeUndefined();
	});
});
