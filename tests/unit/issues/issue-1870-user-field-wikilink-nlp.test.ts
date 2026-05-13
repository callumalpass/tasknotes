import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";

describe("Issue #1870: user field file autosuggest NLP values", () => {
	it("parses wikilink values inserted by custom user field autocomplete triggers", () => {
		const parser = new NaturalLanguageParser(
			[],
			[],
			true,
			"en",
			{
				triggers: [
					{ propertyId: "reference", trigger: "/", enabled: true },
				],
			},
			[
				{
					id: "reference",
					displayName: "Reference",
					key: "reference",
					type: "text",
					autosuggestFilter: { requiredTags: ["reference"] },
				},
			]
		);

		const parsed = parser.parseInput("Follow up /[[Reference Note]]");

		expect(parsed.title).toBe("Follow up");
		expect(parsed.userFields).toEqual({
			reference: "[[Reference Note]]",
		});
	});
});
