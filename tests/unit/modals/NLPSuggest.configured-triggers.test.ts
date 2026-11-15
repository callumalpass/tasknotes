import { App } from "obsidian";
import { NLPSuggest } from "../../../src/modals/taskCreationSuggest";
import { DEFAULT_NLP_TRIGGERS } from "../../../src/settings/defaults";
import { MockObsidian } from "../../helpers/obsidian-runtime";

type Suggestion = { type: string; value: string };
type SuggestInternals = {
	getSuggestions(query: string): Promise<Suggestion[]>;
	selectSuggestion(suggestion: Suggestion): void;
};

function createPlugin(triggers: Record<string, { trigger: string; enabled?: boolean }>) {
	return {
		settings: {
			taskTag: "task",
			taskIdentificationMethod: "tag",
			hideIdentifyingTagsInCards: true,
			userFields: [],
			nlpTriggers: {
				triggers: DEFAULT_NLP_TRIGGERS.triggers.map((trigger) => ({
					...trigger,
					...triggers[trigger.propertyId],
				})),
			},
		},
		cacheManager: {
			getAllContexts: jest.fn(() => ["office", "home"]),
			getAllTags: jest.fn(() => ["work"]),
		},
	};
}

function createSuggest(plugin: ReturnType<typeof createPlugin>, text: string) {
	const input = document.createElement("input");
	document.body.appendChild(input);
	input.value = text;
	input.setSelectionRange(text.length, text.length);
	const app = MockObsidian.createMockApp() as unknown as App;
	const suggest = new NLPSuggest(app, input, plugin as never);
	return { input, suggest: suggest as unknown as SuggestInternals };
}

describe("NLPSuggest configured triggers", () => {
	beforeEach(() => {
		MockObsidian.reset();
		document.body.innerHTML = "";
	});

	it("uses a custom context trigger and inserts it with the suggestion", async () => {
		const plugin = createPlugin({ contexts: { trigger: "%" } });
		const { input, suggest } = createSuggest(plugin, "Call Sam %off");

		const suggestions = await suggest.getSuggestions("");
		expect(suggestions.map((s) => s.value)).toEqual(["office"]);

		suggest.selectSuggestion(suggestions[0]);
		expect(input.value).toBe("Call Sam %office ");
	});

	it("ignores the default character once a trigger is changed", async () => {
		const plugin = createPlugin({ contexts: { trigger: "%" } });
		const { suggest } = createSuggest(plugin, "Email sam@off");

		await expect(suggest.getSuggestions("")).resolves.toEqual([]);
	});

	it("does not suggest for disabled triggers", async () => {
		const plugin = createPlugin({ tags: { trigger: "#", enabled: false } });
		const { suggest } = createSuggest(plugin, "Plan #wo");

		await expect(suggest.getSuggestions("")).resolves.toEqual([]);
	});
});
