import { App } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { renderFeaturesTab } from "../../../src/settings/tabs/featuresTab";
import { renderPriorityPropertyCard } from "../../../src/settings/tabs/taskProperties/priorityPropertyCard";
import { renderStatusPropertyCard } from "../../../src/settings/tabs/taskProperties/statusPropertyCard";
import { observeTranslation } from "../../helpers/real-i18n";

const locales = ["en", "fr", "de", "es", "ja", "ko", "pt", "ru", "zh"];

function input(container: HTMLElement, placeholder: string): HTMLInputElement {
	const result = Array.from(container.querySelectorAll<HTMLInputElement>("input"))
		.find(element => element.placeholder === placeholder);
	expect(result).toBeDefined();
	return result!;
}

describe.each(locales)("technical setting examples in %s", locale => {
	it("preserves icon IDs, identifier examples and configured template paths", () => {
		const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as typeof DEFAULT_SETTINGS;
		settings.taskCreationDefaults.useBodyTemplate = true;
		settings.taskCreationDefaults.bodyTemplate = "Existing Vault/Task Template.md";
		settings.taskCreationDefaults.useOccurrenceBodyTemplate = true;
		settings.taskCreationDefaults.occurrenceBodyTemplate = "Existing Vault/Occurrence Template.md";
		const before = JSON.parse(JSON.stringify(settings));
		const translate = observeTranslation(locale);
		const save = jest.fn();
		const plugin = { app: new App(), settings, fieldMapper: new FieldMapper(settings.fieldMapping), i18n: { translate } } as unknown as TaskNotesPlugin;
		const container = document.createElement("div");
		renderPriorityPropertyCard(container, plugin, save, translate);
		renderStatusPropertyCard(container, plugin, save, translate);
		input(container, "alert-circle");
		input(container, "check, circle, clock");
		input(container, "high");
		input(container, "in-progress");
		renderFeaturesTab(container, plugin, save);
		expect(input(container, "Templates/Task Template.md").value).toBe(before.taskCreationDefaults.bodyTemplate);
		expect(input(container, "Templates/Occurrence Template.md").value).toBe(before.taskCreationDefaults.occurrenceBodyTemplate);
		expect(settings).toEqual(before);
		expect(save).not.toHaveBeenCalled();
	});
});
