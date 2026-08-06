import { App } from "obsidian";
import {
	attachChipEditorContextSuggest,
	ContextSuggest,
	TagSuggest,
} from "../../../src/modals/taskModalSuggests";
import { MockObsidian } from "../../helpers/obsidian-runtime";

const createMockApp = (mockApp: unknown): App => mockApp as App;

function createPlugin() {
	return {
		settings: {
			taskTag: "task",
			taskIdentificationMethod: "tag",
			hideIdentifyingTagsInCards: false,
		},
		cacheManager: {
			getAllContexts: jest.fn(() => ["home", "office"]),
			getAllTags: jest.fn(() => ["review", "writing"]),
		},
	};
}

describe("Issue #1520: tag and context suggestions on field focus", () => {
	let app: App;

	beforeEach(() => {
		MockObsidian.reset();
		app = createMockApp(MockObsidian.createMockApp());
		document.body.innerHTML = "";
	});

	it("opens context suggestions when the context field is focused", () => {
		const input = document.createElement("input");
		document.body.appendChild(input);
		const suggest = new ContextSuggest(app, input, createPlugin() as never);
		const openSpy = jest.spyOn(suggest, "open");

		input.dispatchEvent(new Event("focus"));

		expect(openSpy).toHaveBeenCalledTimes(1);
	});

	it("opens tag suggestions when the tag field is focused", () => {
		const input = document.createElement("input");
		document.body.appendChild(input);
		const suggest = new TagSuggest(app, input, createPlugin() as never);
		const openSpy = jest.spyOn(suggest, "open");

		input.dispatchEvent(new Event("focus"));

		expect(openSpy).toHaveBeenCalledTimes(1);
	});

	it("returns available context and tag suggestions for an empty field", async () => {
		const plugin = createPlugin();
		const contextInput = document.createElement("input");
		const tagInput = document.createElement("input");
		document.body.append(contextInput, tagInput);

		const contextSuggest = new ContextSuggest(app, contextInput, plugin as never);
		const tagSuggest = new TagSuggest(app, tagInput, plugin as never);

		const contextSuggestions = await (contextSuggest as unknown as {
			getSuggestions(query: string): Promise<Array<{ value: string }>>;
		}).getSuggestions("");
		const tagSuggestions = await (tagSuggest as unknown as {
			getSuggestions(query: string): Promise<Array<{ value: string }>>;
		}).getSuggestions("");

		expect(contextSuggestions.map((suggestion) => suggestion.value)).toEqual([
			"home",
			"office",
		]);
		expect(tagSuggestions.map((suggestion) => suggestion.value)).toEqual([
			"review",
			"writing",
		]);
	});
});

describe("Chip editor suggests", () => {
	let app: App;

	beforeEach(() => {
		MockObsidian.reset();
		app = createMockApp(MockObsidian.createMockApp());
		document.body.innerHTML = "";
	});

	it("does not open the suggest popover when every context is already selected", async () => {
		jest.useFakeTimers();
		const input = document.createElement("input");
		document.body.appendChild(input);
		const plugin = {
			cacheManager: {
				getAllContexts: jest.fn(() => ["awd", "fdawd"]),
			},
		};
		const suggest = attachChipEditorContextSuggest(app, input, plugin as never, {
			getSelectedValues: () => ["awd", "fdawd"],
			onAdd: jest.fn(),
		});
		const openSpy = jest.spyOn(suggest, "open");
		const closeSpy = jest.spyOn(suggest, "close");

		jest.runOnlyPendingTimers();
		await Promise.resolve();

		openSpy.mockClear();
		closeSpy.mockClear();

		input.dispatchEvent(new Event("focus"));
		await Promise.resolve();

		expect(openSpy).not.toHaveBeenCalled();
		expect(closeSpy).toHaveBeenCalled();
		jest.useRealTimers();
	});
});
