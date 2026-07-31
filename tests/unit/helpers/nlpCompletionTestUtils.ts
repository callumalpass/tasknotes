import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { createNLPCompletionSource } from "../../../src/editor/NLPCodeMirrorAutocomplete";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { MockObsidian } from "../../helpers/obsidian-runtime";

type CompletionPluginOptions = {
	settings?: Partial<typeof DEFAULT_SETTINGS>;
	contexts?: string[];
	tags?: string[];
};

export function createCompletionPlugin(options: CompletionPluginOptions = {}) {
	const app = MockObsidian.createMockApp();
	const settingsOverrides = options.settings ?? {};

	const settings = {
		...DEFAULT_SETTINGS,
		...settingsOverrides,
		nlpTriggers: settingsOverrides.nlpTriggers
			? {
					triggers: settingsOverrides.nlpTriggers.triggers.map((trigger) => ({
						...trigger,
					})),
				}
			: {
					triggers: DEFAULT_SETTINGS.nlpTriggers.triggers.map((trigger) => ({
						...trigger,
					})),
				},
		projectAutosuggest: {
			...DEFAULT_SETTINGS.projectAutosuggest,
			...(settingsOverrides.projectAutosuggest ?? {}),
		},
		customStatuses:
			settingsOverrides.customStatuses?.map((status) => ({ ...status })) ??
			DEFAULT_SETTINGS.customStatuses.map((status) => ({ ...status })),
		customPriorities:
			settingsOverrides.customPriorities?.map((priority) => ({ ...priority })) ??
			DEFAULT_SETTINGS.customPriorities.map((priority) => ({ ...priority })),
		userFields:
			settingsOverrides.userFields?.map((field) => ({ ...field })) ??
			DEFAULT_SETTINGS.userFields.map((field) => ({ ...field })),
	};

	return {
		app,
		settings,
		cacheManager: {
			getAllContexts: jest.fn(() => options.contexts ?? []),
			getAllTags: jest.fn(() => options.tags ?? []),
		},
		fieldMapper: {
			mapFromFrontmatter: jest.fn((frontmatter: Record<string, unknown>) => ({
				title: typeof frontmatter?.title === "string" ? frontmatter.title : "",
			})),
		},
	};
}

export async function getCompletionResult(
	plugin: ReturnType<typeof createCompletionPlugin>,
	doc: string
): Promise<CompletionResult | null> {
	const state = EditorState.create({ doc, selection: { anchor: doc.length } });
	const context = new CompletionContext(state, doc.length, true);
	return createNLPCompletionSource(plugin as never)(context);
}

export function createMarkdownFile(path: string, frontmatter: Record<string, unknown>): void {
	MockObsidian.createTestFile(path, `---\n${JSON.stringify(frontmatter)}\n---\n`);
}
