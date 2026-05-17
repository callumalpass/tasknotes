import { renderUserFieldsSection } from "../../../src/settings/tabs/taskProperties/userFieldsCard";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import type { TaskNotesSettings } from "../../../src/types/settings";

const translate = (key: string) => key;

function createPlugin(settings: Partial<TaskNotesSettings> = {}): any {
	const baseSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as TaskNotesSettings;
	return {
		settings: {
			...baseSettings,
			...settings,
		},
	};
}

function inputByPlaceholder(container: HTMLElement, placeholder: string): HTMLInputElement {
	const input = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
		(candidate) => candidate.placeholder === placeholder
	);
	if (!input) {
		throw new Error(`Missing input with placeholder ${placeholder}`);
	}
	return input;
}

function updateInput(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Issue #1419: custom user field settings save while typing", () => {
	it("updates custom user field display name and property key on input", () => {
		const save = jest.fn();
		const plugin = createPlugin({
			userFields: [
				{
					id: "field_1419",
					displayName: "",
					key: "",
					type: "text",
				},
			],
			modalFieldsConfig: {
				fields: [
					{
						id: "field_1419",
						fieldType: "user",
						group: "custom",
						displayName: "",
						visibleInCreation: true,
						visibleInEdit: true,
						order: 0,
						enabled: true,
					},
				],
			},
		});
		const container = document.createElement("div");

		renderUserFieldsSection(container, plugin, save, translate as never);

		updateInput(
			inputByPlaceholder(
				container,
				"settings.taskProperties.customUserFields.placeholders.displayName"
			),
			"CEU Credits"
		);
		updateInput(
			inputByPlaceholder(
				container,
				"settings.taskProperties.customUserFields.placeholders.propertyKey"
			),
			"ceu_credits"
		);

		expect(plugin.settings.userFields[0]).toMatchObject({
			displayName: "CEU Credits",
			key: "ceu_credits",
		});
		expect(plugin.settings.modalFieldsConfig?.fields[0].displayName).toBe("CEU Credits");
		expect(save).toHaveBeenCalledTimes(2);
	});

	it("updates text, list, and number defaults on input", () => {
		const save = jest.fn();
		const plugin = createPlugin({
			userFields: [
				{ id: "text_field", displayName: "Text", key: "text", type: "text" },
				{ id: "list_field", displayName: "List", key: "list", type: "list" },
				{ id: "number_field", displayName: "Number", key: "number", type: "number" },
			],
		});
		const container = document.createElement("div");

		renderUserFieldsSection(container, plugin, save, translate as never);

		const defaultInputs = Array.from(container.querySelectorAll<HTMLInputElement>("input")).filter(
			(input) =>
				input.placeholder ===
					"settings.taskProperties.customUserFields.placeholders.defaultValue" ||
				input.placeholder ===
					"settings.taskProperties.customUserFields.placeholders.defaultValueList"
		);

		updateInput(defaultInputs[0], "review");
		updateInput(defaultInputs[1], "alpha, beta");
		updateInput(defaultInputs[2], "7.5");

		expect(plugin.settings.userFields[0].defaultValue).toBe("review");
		expect(plugin.settings.userFields[1].defaultValue).toEqual(["alpha", "beta"]);
		expect(plugin.settings.userFields[2].defaultValue).toBe(7.5);
		expect(save).toHaveBeenCalledTimes(3);
	});
});
