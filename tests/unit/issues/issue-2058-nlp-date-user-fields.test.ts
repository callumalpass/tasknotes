import type TaskNotesPlugin from "../../../src/main";
import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { buildTaskCreationDataFromParsed } from "../../../src/services/buildTaskCreationDataFromParsed";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import type { NLPTriggersConfig, UserMappedField } from "../../../src/types/settings";

const DATE_FIELD: UserMappedField = {
	id: "snoozed",
	displayName: "Snoozed",
	key: "snoozed",
	type: "date",
};

const NLP_TRIGGERS: NLPTriggersConfig = {
	triggers: [{ propertyId: "snoozed", trigger: "s:", enabled: true }],
};

function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function tomorrowDate(): string {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	return formatDate(tomorrow);
}

function createParser(): NaturalLanguageParser {
	return new NaturalLanguageParser([], [], true, "en", NLP_TRIGGERS, [DATE_FIELD]);
}

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {
			...DEFAULT_SETTINGS,
			userFields: [DATE_FIELD],
		},
	} as unknown as TaskNotesPlugin;
}

describe("Issue #2058: NLP date user fields", () => {
	it("parses natural-language values for date-type custom fields", () => {
		const parsed = createParser().parseInput("Review invoices s:tomorrow");

		expect(parsed.title).toBe("Review invoices");
		expect((parsed.userFields as Record<string, unknown>).snoozed).toBe(tomorrowDate());

		const taskData = buildTaskCreationDataFromParsed(createPlugin(), parsed);

		expect(taskData.customFrontmatter).toEqual({ snoozed: tomorrowDate() });
	});

	it("leaves unrecognized date custom field values untouched", () => {
		const parsed = createParser().parseInput("Review invoices s:later");

		expect(parsed.title).toBe("Review invoices");
		expect(parsed.userFields).toEqual({ snoozed: "later" });
	});
});
