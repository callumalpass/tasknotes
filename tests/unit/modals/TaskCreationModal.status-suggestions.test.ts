import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { MockObsidian } from "../../__mocks__/obsidian";
import { createCompletionPlugin, getCompletionResult } from "../helpers/nlpCompletionTestUtils";

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
});
