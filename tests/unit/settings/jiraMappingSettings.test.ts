import type TaskNotesPlugin from "../../../src/main";
import { createDefaultJiraMappingSettings } from "../../../src/integrations/jira/JiraFieldMapping";
import {
	parseJiraEnumRemaps,
	renderJiraMappingSettings,
	serializeJiraIssuePreview,
} from "../../../src/settings/tabs/jiraMappingSettings";
import type { JiraIssue } from "../../../src/integrations/jira/JiraIssueAdapter";

describe("Jira mapping settings", () => {
	const previewTranslations: Record<string, string> = {
		"settings.integrations.jiraMapping.preview.sampleIssue": "Sample issue",
		"settings.integrations.jiraMapping.preview.sampleIssueDescription": "Fetch a sample",
		"settings.integrations.jiraMapping.preview.issueKey": "Sample Jira issue key",
		"settings.integrations.jiraMapping.preview.issueKeyPlaceholder": "PROJ-123",
		"settings.integrations.jiraMapping.preview.fetch": "Fetch preview",
		"settings.integrations.jiraMapping.preview.loading": "Loading…",
		"settings.integrations.jiraMapping.preview.unknownError": "Unknown error",
		"settings.integrations.jiraMapping.preview.resolvedValues": "Resolved values",
		"settings.integrations.jiraMapping.preview.resolvedValuesDescription": "Mapped values",
		"settings.integrations.jiraMapping.preview.missing": "Not set",
		"settings.integrations.jiraMapping.preview.invalid": "Invalid value",
		"settings.integrations.jiraMapping.preview.rawJson": "Raw Jira issue JSON",
		"settings.integrations.jiraMapping.preview.rawJsonDescription": "Sensitive data",
		"settings.integrations.jiraMapping.preview.truncated": "Truncated",
	};

	it("parses enum remap rows and ignores incomplete rows", () => {
		expect(
			parseJiraEnumRemaps(
				"in-progress = In Progress, Doing\nhigh = Major\nmissing separator\n = Empty"
			)
		).toEqual([
			{
				taskValue: "in-progress",
				jiraValues: ["In Progress", "Doing"],
			},
			{
				taskValue: "high",
				jiraValues: ["Major"],
			},
		]);
	});

	it("resets mappings and persists the restored defaults", () => {
		const container = document.createElement("div");
		const jiraMapping = createDefaultJiraMappingSettings();
		jiraMapping.fields.title = [{ mode: "fixed", value: "Custom title" }];
		const save = jest.fn();
		const translations: Record<string, string> = {
			"settings.integrations.jiraMapping.header": "Jira field mapping",
			"settings.integrations.jiraMapping.description": "Description",
			"settings.integrations.jiraMapping.reset": "Reset mappings",
			"settings.integrations.jiraMapping.sourcesHeader": "Property sources",
			"settings.integrations.jiraMapping.sourcesDescription": "Sources",
			"settings.integrations.jiraMapping.userFieldsHeader": "User fields",
			"settings.integrations.jiraMapping.userFieldsDescription": "User field sources",
			"settings.integrations.jiraMapping.remapsHeader": "Value remapping",
			"settings.integrations.jiraMapping.remapsDescription": "Remaps",
			...previewTranslations,
		};
		const plugin = {
			settings: {
				jiraMapping,
				userFields: [],
			},
			i18n: {
				translate: (key: string) => translations[key] ?? key,
			},
		} as unknown as TaskNotesPlugin;

		renderJiraMappingSettings(container, plugin, save);
		const resetButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Reset mappings"
		);
		resetButton?.click();

		expect(resetButton).toBeDefined();
		expect(plugin.settings.jiraMapping.fields.title).toEqual(
			createDefaultJiraMappingSettings().fields.title
		);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("truncates large raw issue payloads", () => {
		const issue = {
			key: "MAGIC-1",
			fields: { summary: "x".repeat(100) },
		} as JiraIssue;

		expect(serializeJiraIssuePreview(issue, 20)).toEqual({
			text: expect.stringMatching(/^.{20}\n…$/s),
			truncated: true,
		});
	});

	it("fetches an ephemeral sample and renders raw JSON as inert text", async () => {
		const container = document.createElement("div");
		const save = jest.fn();
		const issue = {
			key: "MAGIC-17",
			fields: { summary: '<img src=x onerror="alert(1)">' },
		};
		const getIssue = jest.fn().mockResolvedValue(issue);
		const plugin = {
			app: {
				plugins: {
					getPlugin: () => ({ api: { base: { getIssue } } }),
				},
			},
			settings: {
				jiraMapping: createDefaultJiraMappingSettings(),
				userFields: [],
			},
			i18n: {
				translate: (key: string) => previewTranslations[key] ?? key,
			},
		} as unknown as TaskNotesPlugin;

		renderJiraMappingSettings(container, plugin, save);
		const input = container.querySelector(
			'input[placeholder="PROJ-123"]'
		) as HTMLInputElement;
		input.value = "magic-17";
		input.dispatchEvent(new window.Event("input"));
		const fetchButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Fetch preview"
		);
		fetchButton?.click();
		await Promise.resolve();
		await Promise.resolve();

		const raw = container.querySelector("pre");
		const details = container.querySelector("details");
		expect(getIssue).toHaveBeenCalledWith("MAGIC-17");
		expect(raw?.textContent).toContain("<img src=x onerror=");
		expect(raw?.textContent).toContain("alert(1)");
		expect(container.querySelector("img")).toBeNull();
		expect(details?.open).toBe(false);
		expect(save).not.toHaveBeenCalled();
		expect(JSON.stringify(plugin.settings)).not.toContain("MAGIC-17");
	});

	it("renders loading and fetch error states", async () => {
		const container = document.createElement("div");
		let rejectFetch: (error: Error) => void = () => {};
		const getIssue = jest.fn(
			() =>
				new Promise((_resolve, reject) => {
					rejectFetch = reject;
				})
		);
		const plugin = {
			app: {
				plugins: {
					getPlugin: () => ({ api: { base: { getIssue } } }),
				},
			},
			settings: {
				jiraMapping: createDefaultJiraMappingSettings(),
				userFields: [],
			},
			i18n: {
				translate: (key: string) => previewTranslations[key] ?? key,
			},
		} as unknown as TaskNotesPlugin;

		renderJiraMappingSettings(container, plugin, jest.fn());
		const input = container.querySelector(
			'input[placeholder="PROJ-123"]'
		) as HTMLInputElement;
		input.value = "MAGIC-17";
		input.dispatchEvent(new window.Event("input"));
		Array.from(container.querySelectorAll("button"))
			.find((button) => button.textContent === "Fetch preview")
			?.click();

		expect(container.textContent).toContain("Loading…");
		rejectFetch(new Error("Jira is taking a nap"));
		await Promise.resolve();
		await Promise.resolve();
		expect(container.textContent).toContain("Failed to fetch Jira issue MAGIC-17");
	});
});
