import { App } from "obsidian";
import { msg } from "@lingui/core/macro";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { configLabel } from "../../../src/i18n/configLabels";
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
	it("keeps semantic single and multiple Bases groups distinct, including Russian 21", () => {
		const translate = observeTranslation(locale);
		const classifiers = [
			msg({ message: "{count, plural, =0 {No contexts} =1 {Single context} other {Multiple contexts}}", context: "generated Bases contexts count" }),
			msg({ message: "{count, plural, =0 {No projects} =1 {Single project} other {Multiple projects}}", context: "generated Bases projects count" }),
		];
		for (const descriptor of classifiers) {
			const show = (count: number) => translate(descriptor, { count });
			expect(show(0)).not.toBe(show(1));
			expect(show(1)).not.toBe(show(2));
			for (const count of [2, 5, 21]) expect(show(count)).toBe(show(2));
		}
	});
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
		const displayed = Array.from(container.querySelectorAll<HTMLInputElement>("input")).map(element => element.value);
		expect(displayed).toEqual(expect.arrayContaining([...settings.customStatuses.map(configLabel), ...settings.customPriorities.map(configLabel)]));
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
