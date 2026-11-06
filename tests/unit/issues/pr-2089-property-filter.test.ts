import { matchesProjectProperty } from "../../../src/utils/projectFilterUtils";
import { createCompletionPlugin, createMarkdownFile, getCompletionResult } from "../helpers/nlpCompletionTestUtils";
import { ProjectSelectModal } from "../../../src/modals/ProjectSelectModal";
import { NLPSuggest } from "../../../src/modals/taskCreationSuggest";
import { createI18nService } from "../../../src/i18n";
import { MockObsidian } from "../../helpers/obsidian-runtime";

function matches(actual: unknown, value: string) {
	return matchesProjectProperty({ status: actual }, { key: "status", value, enabled: true });
}

describe("PR 2089: property-value expressions", () => {
	it.each(["not started", '"active"', "'active'", "!important", "not done, active"])("keeps legacy literal filter %s", value => {
		const firstLiteral = value.split(",")[0];
		expect(matches(firstLiteral, value)).toBe(true);
		expect(matches("other", value)).toBe(false);
	});

	it.each(["", "   ", []])("keeps key-only matching for empty property %j", value => {
		expect(matches(value, "")).toBe(true);
	});

	it.each([undefined, null])("keeps key-only rejection for absent property %s", value => {
		expect(matches(value, "")).toBe(false);
	});

	it.each(['containsAny("active", "planned")', "CONTAINSANY('active', planned)"])("supports explicit inclusion %s", expression => {
		expect(matches("Planned", expression)).toBe(true);
		expect(matches("active-extra", expression)).toBe(false);
	});

	it.each(['!containsAny("done", "archived")', "not containsAny('done', archived)"])("supports negation %s", expression => {
		expect(matches("active", expression)).toBe(true);
		expect(matches(["work", "DONE"], expression)).toBe(false);
		for (const empty of [undefined, null, "", "   ", []]) expect(matches(empty, expression)).toBe(false);
		expect(matchesProjectProperty({}, { key: "status", value: expression, enabled: true })).toBe(false);
	});

	it("does not split commas inside quoted arguments", () => {
		expect(matches("done, archived", '!containsAny("done, archived")')).toBe(false);
		expect(matches("done", '!containsAny("done, archived")')).toBe(true);
		expect(matches("work, active", "containsAny('work, active', planned)")).toBe(true);
	});

	it("parses escaped quotes and backslashes", () => {
		expect(matches('say "yes"', String.raw`containsAny("say \"yes\"")`)).toBe(true);
		expect(matches(String.raw`work\active`, String.raw`containsAny("work\\active")`)).toBe(true);
	});

	it.each([
		"containsAny()", "!containsAny()", 'containsAny("unclosed)',
		'containsAny("active",)', 'containsAny(,active)', 'containsAny("active" junk)',
		'containsAny("active") trailing', 'not containsAny("done"', 'containsAny(foo(bar))',
		'containsAny("a""b")',
	])("fails closed for malformed explicit call %s", expression => {
		expect(matches("active", expression)).toBe(false);
		expect(matches(expression, expression)).toBe(false);
	});

	it("matches booleans and numbers without substring matching", () => {
		expect(matches(false, "containsAny(false, 42)")).toBe(true);
		expect(matches(42, "containsAny(false, 42)")).toBe(true);
		expect(matches(4, "containsAny(false, 42)")).toBe(false);
	});
});

describe("PR 2089: project suggestion entry points", () => {
	beforeEach(() => MockObsidian.reset());
	function setup() {
		const plugin = createCompletionPlugin({ settings: { projectAutosuggest: {
			propertyKey: "status", propertyValue: '!containsAny("archived", "done")',
			requiredTags: [], includeFolders: [], rows: [], enableFuzzy: false,
		} } });
		createMarkdownFile("Projects/Active.md", { status: "active" });
		createMarkdownFile("Projects/Archived.md", { status: "archived" });
		createMarkdownFile("Projects/Missing.md", {});
		return plugin;
	}

	it("excludes archived and missing values from + CodeMirror suggestions", async () => {
		const result = await getCompletionResult(setup(), "+");
		expect(result?.options.map(option => option.apply)).toEqual(["[[Active]] "]);
	});

	it("excludes archived and missing values from + textarea suggestions", async () => {
		const plugin = setup();
		const suggest = new NLPSuggest(plugin.app as never, document.createElement("textarea"), plugin as never);
		const items = await (suggest as unknown as { getProjectSuggestions(query: string): Promise<Array<{ insertText: string }>> }).getProjectSuggestions("");
		expect(items).toHaveLength(1);
		expect(JSON.stringify(items)).toContain("Active");
	});

	it("excludes archived and missing values from the project picker", () => {
		const plugin = setup();
		(plugin.app.vault as any).getAllLoadedFiles = () => plugin.app.vault.getFiles();
		const modal = new ProjectSelectModal(plugin.app as never, { ...plugin, i18n: createI18nService() } as never, jest.fn());
		expect(modal.getItems().map(item => item.path)).toEqual(["Projects/Active.md"]);
	});
});
