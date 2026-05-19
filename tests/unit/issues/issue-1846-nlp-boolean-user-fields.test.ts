import type TaskNotesPlugin from "../../../src/main";
import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import type { NLPTriggersConfig, UserMappedField } from "../../../src/types/settings";
import { buildTaskCreationDataFromParsed } from "../../../src/services/buildTaskCreationDataFromParsed";

const BOOLEAN_FIELD: UserMappedField = {
	id: "reviewed",
	displayName: "Reviewed",
	key: "reviewed",
	type: "boolean",
};

const NLP_TRIGGERS: NLPTriggersConfig = {
	triggers: [{ propertyId: "reviewed", trigger: "!", enabled: true }],
};

function createParser(): NaturalLanguageParser {
	return new NaturalLanguageParser([], [], true, "en", NLP_TRIGGERS, [BOOLEAN_FIELD]);
}

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {
			...DEFAULT_SETTINGS,
			userFields: [BOOLEAN_FIELD],
		},
	} as unknown as TaskNotesPlugin;
}

describe("Issue #1846: NLP boolean user fields", () => {
	it("keeps true boolean trigger values as booleans in task frontmatter", () => {
		const parsed = createParser().parseInput("Review release !true");

		expect(parsed.title).toBe("Review release");
		expect((parsed.userFields as Record<string, unknown>).reviewed).toBe(true);

		const taskData = buildTaskCreationDataFromParsed(createPlugin(), parsed);

		expect(taskData.customFrontmatter).toEqual({ reviewed: true });
		expect(typeof taskData.customFrontmatter?.reviewed).toBe("boolean");
	});

	it("keeps false boolean trigger values as booleans in task frontmatter", () => {
		const parsed = createParser().parseInput("Review release !false");

		expect(parsed.title).toBe("Review release");
		expect((parsed.userFields as Record<string, unknown>).reviewed).toBe(false);

		const taskData = buildTaskCreationDataFromParsed(createPlugin(), parsed);

		expect(taskData.customFrontmatter).toEqual({ reviewed: false });
		expect(typeof taskData.customFrontmatter?.reviewed).toBe("boolean");
	});
});
