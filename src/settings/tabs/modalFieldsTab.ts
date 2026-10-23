import { msg } from "@lingui/core/macro";
import { Notice } from "obsidian";
import TaskNotesPlugin from "../../main";
import type { TranslationKey } from "../../i18n";
import { createSettingGroup, configureToggleSetting } from "../components/settingHelpers";
import { createFieldManager } from "../components/FieldManagerComponent";
import { initializeFieldConfig } from "../../utils/fieldConfigDefaults";
import type { TaskModalFieldsConfig, UserMappedField } from "../../types/settings";
import { showConfirmationModal } from "../../modals/ConfirmationModal";

/**
 * Renders the Modal Fields Configuration tab
 */
export function renderModalFieldsTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// Ensure modal fields config exists
	if (!plugin.settings.modalFieldsConfig) {
		plugin.settings.modalFieldsConfig = initializeFieldConfig(
			undefined,
			plugin.settings.userFields
		);
		save(); // Save the initialized config
	}

	// Configuration Section
	createSettingGroup(
		container,
		{
			heading: translate(msg({ message: "Task modal fields configuration", context: "settings.modalFields.header" })),
			description: translate(msg({ message: "Configure which fields appear in task creation and edit modals. Drag fields to reorder them within each group.", context: "settings.modalFields.description" })),
		},
		(group) => {
			// Split layout toggle
			group.addSetting((setting) => {
				configureToggleSetting(setting, {
					name: translate(msg({ message: "Split layout on wide screens", context: "settings.modalFields.splitLayout.name" })),
					desc: translate(msg({ message: "When enabled, the details editor appears in a right column on screens 900px or wider. When disabled, the modal uses a stacked layout.", context: "settings.modalFields.splitLayout.description" })),
					getValue: () => plugin.settings.enableModalSplitLayout,
					setValue: (value) => {
						plugin.settings.enableModalSplitLayout = value;
						save();
					},
				});
			});

			group.addSetting((setting) => {
				configureToggleSetting(setting, {
					name: translate(msg({ message: "Tab moves focus in details editor", context: "settings.modalFields.tabMovesFocus.name" })),
					desc: translate(msg({ message: "When enabled, Tab moves from the details editor to the next modal field and Shift+Tab moves to the previous field. When disabled, Tab and Shift+Tab use the markdown editor''s indentation behavior.", context: "settings.modalFields.tabMovesFocus.description" })),
					getValue: () => plugin.settings.taskModalTabMovesFocus,
					setValue: (value) => {
						plugin.settings.taskModalTabMovesFocus = value;
						save();
					},
				});
			});

			// Sync button
			group.addSetting((setting) => {
				setting
					.setName(translate(msg({ message: "Sync user fields", context: "settings.modalFields.sync.name" })))
					.setDesc(translate(msg({ message: "Click to sync custom user fields from task properties settings into this configuration.", context: "settings.modalFields.sync.description" })))
					.addButton((button) => {
						button
							.setButtonText(translate(msg({ message: "Sync user fields", context: "settings.modalFields.sync.button" })))
							.setCta()
							.onClick(() => {
								syncUserFieldsToConfig(plugin);
								save();
								new Notice(translate(msg({ message: "User fields synced to modal configuration", context: "settings.modalFields.sync.notice" })));
								// Re-render the tab
								renderModalFieldsTab(container, plugin, save);
							});
					});
			});

			// Reset button
			group.addSetting((setting) => {
				setting
					.setName(translate(msg({ message: "Reset to defaults", context: "settings.modalFields.reset.name" })))
					.setDesc(translate(msg({ message: "Reset all field configurations to their default values. This will remove any custom configurations.", context: "settings.modalFields.reset.description" })))
					.addButton((button) => {
						button
							.setButtonText(translate(msg({ message: "Reset to defaults", context: "settings.modalFields.reset.button" })))
							// Keep destructive styling compatible with Obsidian 1.12.
							.setClass("mod-warning")
							.onClick(async () => {
								const confirmed = await showConfirmationModal(plugin.app, {
									title: translate(msg({ message: "Reset field configuration", context: "settings.modalFields.reset.confirmTitle" })),
									message: translate(msg({ message: "Are you sure you want to reset field configuration to defaults? This will remove any custom field configurations.", context: "settings.modalFields.reset.confirmMessage" })),
									confirmText: translate(msg({ message: "Reset", context: "settings.modalFields.reset.confirmText" })),
									cancelText: translate(msg({ message: "Cancel", context: "settings.modalFields.reset.cancelText" })),
									isDestructive: true,
								});

								if (confirmed) {
									plugin.settings.modalFieldsConfig = initializeFieldConfig(
										undefined,
										plugin.settings.userFields
									);
									save();
									new Notice(translate(msg({ message: "Field configuration reset to defaults", context: "settings.modalFields.reset.notice" })));
									// Re-render the tab
									renderModalFieldsTab(container, plugin, save);
								}
							});
					});
			});
		}
	);

	// Field manager (keep existing component for now - has its own internal tabs)
	const managerContainer = container.createDiv({ cls: "modal-fields-manager-container" });

	// Double-check config exists before creating field manager
	if (!plugin.settings.modalFieldsConfig) {
		managerContainer.createDiv({ text: translate(msg({ message: "Error: Could not initialize field configuration", context: "settings.modalFields.initError" })) });
		return;
	}

	createFieldManager(
		managerContainer,
		plugin,
		plugin.settings.modalFieldsConfig,
		(updatedConfig: TaskModalFieldsConfig) => {
			plugin.settings.modalFieldsConfig = updatedConfig;
			save();
		},
		plugin.app
	);
}

/**
 * Syncs user fields from the old system into the modal field configuration
 */
function syncUserFieldsToConfig(plugin: TaskNotesPlugin): void {
	if (!plugin.settings.modalFieldsConfig) {
		plugin.settings.modalFieldsConfig = initializeFieldConfig(
			undefined,
			plugin.settings.userFields
		);
		return;
	}

	if (!plugin.settings.userFields || plugin.settings.userFields.length === 0) {
		return;
	}

	const config = plugin.settings.modalFieldsConfig;

	// Get existing user field IDs in config
	const existingUserFieldIds = new Set(
		config.fields.filter((f) => f.fieldType === "user").map((f) => f.id)
	);

	// Add new user fields from settings
	plugin.settings.userFields.forEach((userField: UserMappedField) => {
		if (!existingUserFieldIds.has(userField.id)) {
			// Find the highest order in custom group
			const customGroupFields = config.fields.filter((f) => f.group === "custom");
			const maxOrder =
				customGroupFields.length > 0
					? Math.max(...customGroupFields.map((f) => f.order))
					: -1;

			config.fields.push({
				id: userField.id,
				fieldType: "user",
				group: "custom",
				displayName: userField.displayName,
				visibleInCreation: true,
				visibleInEdit: true,
				order: maxOrder + 1,
				enabled: true,
			});
		} else {
			// Update display name if changed
			const fieldIndex = config.fields.findIndex((f) => f.id === userField.id);
			if (fieldIndex !== -1) {
				config.fields[fieldIndex].displayName = userField.displayName;
			}
		}
	});

	// Remove user fields that no longer exist in userFields
	const currentUserFieldIds = new Set(
		plugin.settings.userFields.map((f: UserMappedField) => f.id)
	);
	config.fields = config.fields.filter(
		(f) => f.fieldType !== "user" || currentUserFieldIds.has(f.id)
	);
}
