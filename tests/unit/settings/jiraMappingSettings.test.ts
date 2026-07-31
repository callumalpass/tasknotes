import type TaskNotesPlugin from "../../../src/main";
import { createDefaultJiraMappingSettings } from "../../../src/integrations/jira/JiraFieldMapping";
import {
	parseJiraEnumRemaps,
	renderJiraMappingSettings,
} from "../../../src/settings/tabs/jiraMappingSettings";

describe("Jira mapping settings", () => {
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
});
