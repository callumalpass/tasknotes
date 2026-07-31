import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import { createCompletionPlugin, getCompletionResult } from "../helpers/nlpCompletionTestUtils";
import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { createNLPCompletionSource } from "../../../src/editor/NLPCodeMirrorAutocomplete";
import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";

const customStatuses = [
	{
		id: "open",
		value: "open",
		label: "Open",
		color: "#808080",
		isCompleted: false,
		order: 1,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "active",
		value: "active",
		label: "Active = Now",
		color: "#0066cc",
		isCompleted: false,
		order: 2,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "in-progress",
		value: "in-progress",
		label: "In Progress",
		color: "#ff9900",
		isCompleted: false,
		order: 3,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
];

describe("TaskCreationModal status autocomplete", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("returns status completions for the configured status trigger", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				customStatuses,
			},
		});

		const result = await getCompletionResult(plugin, "Task with *act");
		const activeCompletion = result?.options.find(
			(completion) => completion.label === "Active = Now"
		);

		expect(result?.from).toBe("Task with *".length);
		expect(activeCompletion).toMatchObject({
			apply: "active ",
			info: "Status",
		});
	});

	it("matches partial status labels", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				customStatuses,
			},
		});

		await expect(getCompletionResult(plugin, "Task *in")).resolves.toMatchObject({
			options: [expect.objectContaining({ label: "In Progress", apply: "in-progress " })],
		});
	});

	it("honours custom status trigger characters from nlpTriggers", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				customStatuses,
				nlpTriggers: {
					triggers: DEFAULT_SETTINGS.nlpTriggers.triggers.map((trigger) =>
						trigger.propertyId === "status" ? { ...trigger, trigger: "~" } : trigger
					),
				},
			},
		});

		await expect(getCompletionResult(plugin, "Task ~act")).resolves.toMatchObject({
			options: [expect.objectContaining({ label: "Active = Now" })],
		});
		await expect(getCompletionResult(plugin, "Task *act")).resolves.toBeNull();
	});

	it("does not offer status completions when the status trigger is disabled", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				customStatuses,
				nlpTriggers: {
					triggers: DEFAULT_SETTINGS.nlpTriggers.triggers.map((trigger) =>
						trigger.propertyId === "status"
							? { ...trigger, enabled: false }
							: trigger
					),
				},
			},
		});

		await expect(getCompletionResult(plugin, "Task *act")).resolves.toBeNull();
	});

	it("supports complex status labels without confusing the completion query", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				customStatuses: [
					...customStatuses,
					{
						id: "review",
						value: "review",
						label: "Status: Waiting for Review (2024)",
						color: "#663399",
						isCompleted: false,
						order: 4,
						autoArchive: false,
						autoArchiveDelay: 5,
					},
				],
			},
		});

		await expect(getCompletionResult(plugin, "Task *wait")).resolves.toMatchObject({
			options: [
				expect.objectContaining({
					label: "Status: Waiting for Review (2024)",
					apply: "review ",
				}),
			],
		});
	});

	it("replaces the paired status trigger inserted by the editor", async () => {
		const plugin = createCompletionPlugin({
			settings: {
				customStatuses: [
					{
						id: "open",
						value: "00 Task - Open",
						label: "Task - Open",
						color: "#808080",
						isCompleted: false,
						order: 1,
						autoArchive: false,
						autoArchiveDelay: 5,
					},
					{
						id: "person",
						value: "31 Resource - Person",
						label: "Resource-Person",
						color: "#0066cc",
						isCompleted: false,
						order: 2,
						autoArchive: false,
						autoArchiveDelay: 5,
					},
				],
			},
		});

		const doc = "Test **";
		const cursor = "Test *".length;
		const state = EditorState.create({ doc, selection: { anchor: cursor } });
		const context = new CompletionContext(state, cursor, true);
		const result = await createNLPCompletionSource(plugin as never)(context);
		const completion = result?.options.find((option) => option.label === "Resource-Person");

		expect(completion?.apply).toBe("31 Resource - Person ");
		expect(result?.from).toBe(cursor);
		expect(result?.to).toBe(cursor + 1);

		const applyText = typeof completion?.apply === "string" ? completion.apply : "";
		const accepted = doc.slice(0, result?.from) + applyText + doc.slice(result?.to);
		expect(accepted).toBe("Test *31 Resource - Person ");

		const parsed = NaturalLanguageParser.fromPlugin(plugin as never).parseInput(accepted);
		expect(parsed.title).toBe("Test");
		expect(parsed.status).toBe("31 Resource - Person");
	});
});
