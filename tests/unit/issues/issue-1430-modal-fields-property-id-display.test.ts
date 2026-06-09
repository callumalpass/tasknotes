import { App } from "obsidian";
import { createFieldManager } from "../../../src/settings/components/FieldManagerComponent";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskModalFieldsConfig, UserMappedField } from "../../../src/types/settings";

describe("Issue #1430: Modal Fields displays property keys for custom fields", () => {
	let container: HTMLElement;

	beforeEach(() => {
		document.body.innerHTML = "";
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	it("shows the customized property key for user fields instead of the internal ID", () => {
		const userFields: UserMappedField[] = [
			{
				id: "field_1735011234",
				displayName: "My Custom Field",
				key: "propID",
				type: "text",
			},
		];

		renderFieldManager(userFields);

		expect(getSecondaryText("field_1735011234")).toBe("Key: propID");
		expect(getSecondaryText("field_1735011234")).not.toContain("field_1735011234");
	});

	it("keeps core fields labelled by their stable modal field ID", () => {
		renderFieldManager([]);

		expect(getSecondaryText("title")).toBe("ID: title");
	});

	it("shows a clear fallback for user fields without a configured property key", () => {
		renderFieldManager([
			{
				id: "field_1735011234",
				displayName: "My Custom Field",
				key: "",
				type: "text",
			},
		]);

		expect(getSecondaryText("field_1735011234")).toBe("No key set");
	});

	function renderFieldManager(userFields: UserMappedField[]) {
		const plugin = {
			settings: { userFields },
		} as TaskNotesPlugin;

		createFieldManager(
			container,
			plugin,
			createModalFieldsConfig(),
			jest.fn(),
			new App()
		);
	}

	function getSecondaryText(fieldId: string): string | null | undefined {
		return container.querySelector(
			`[data-card-id="${fieldId}"] .tasknotes-settings__card-secondary-text`
		)?.textContent;
	}

	function createModalFieldsConfig(): TaskModalFieldsConfig {
		return {
			version: 1,
			fields: [
				{
					id: "title",
					fieldType: "core",
					group: "custom",
					displayName: "Title",
					visibleInCreation: true,
					visibleInEdit: true,
					order: 0,
					enabled: true,
				},
				{
					id: "field_1735011234",
					fieldType: "user",
					group: "custom",
					displayName: "My Custom Field",
					visibleInCreation: true,
					visibleInEdit: true,
					order: 1,
					enabled: true,
				},
			],
			groups: [
				{
					id: "custom",
					displayName: "Custom Fields",
					order: 0,
					collapsible: true,
					defaultCollapsed: false,
				},
			],
		};
	}
});
