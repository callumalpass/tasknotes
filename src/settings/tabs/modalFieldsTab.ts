import { Notice } from "obsidian";
import TaskNotesPlugin from "../../main";
import { TranslationKey } from "../../i18n";
import { createSectionHeader, createHelpText, createToggleSetting } from "../components/settingHelpers";
import { createFieldManager, addFieldManagerStyles } from "../components/FieldManagerComponent";
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

	// Add styles for field manager
	addFieldManagerStyles();

	// Ensure modal fields config exists
	if (!plugin.settings.modalFieldsConfig) {
		plugin.settings.modalFieldsConfig = initializeFieldConfig(
			undefined,
			plugin.settings.userFields
		);
		save(); // Save the initialized config
	}

	// Header
	createSectionHeader(
		container,
		"Task Modal Fields Configuration"
	);

	createHelpText(
		container,
		"Configure which fields appear in task creation and edit modals. Drag fields to reorder them within each group."
	);

	// Split layout toggle
	createToggleSetting(container, {
		name: "Split layout on wide screens",
		desc: "When enabled, the details editor appears in a right column on screens 900px or wider. When disabled, the modal uses a stacked layout.",
		getValue: () => plugin.settings.enableModalSplitLayout,
		setValue: (value) => {
			plugin.settings.enableModalSplitLayout = value;
			save();
		},
	});

	// Sync button to update from user fields
	const syncContainer = container.createDiv({ cls: "modal-fields-sync" });
	const syncButton = syncContainer.createEl("button", {
		cls: "mod-cta",
		text: "Sync User Fields",
	});
	syncButton.onclick = () => {
		syncUserFieldsToConfig(plugin);
		save();
		new Notice("User fields synced to modal configuration");
		// Re-render the tab
		renderModalFieldsTab(container, plugin, save);
	};

	createHelpText(
		syncContainer,
		"Click to sync custom user fields from Task Properties settings into this configuration."
	);

	// Field manager
	const managerContainer = container.createDiv({ cls: "modal-fields-manager-container" });

	// Double-check config exists before creating field manager
	if (!plugin.settings.modalFieldsConfig) {
		managerContainer.createDiv({ text: "Error: Could not initialize field configuration" });
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

	// Reset button
	const resetContainer = container.createDiv({ cls: "modal-fields-reset" });
	const resetButton = resetContainer.createEl("button", {
		cls: "mod-warning",
		text: "Reset to Defaults",
	});
	resetButton.onclick = async () => {
		const confirmed = await showConfirmationModal(plugin.app, {
			title: "Reset Field Configuration",
			message: "Are you sure you want to reset field configuration to defaults? This will remove any custom field configurations.",
			confirmText: "Reset",
			cancelText: "Cancel",
			isDestructive: true,
		});

		if (confirmed) {
			plugin.settings.modalFieldsConfig = initializeFieldConfig(
				undefined,
				plugin.settings.userFields
			);
			save();
			new Notice("Field configuration reset to defaults");
			// Re-render the tab
			renderModalFieldsTab(container, plugin, save);
		}
	};
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
			const maxOrder = customGroupFields.length > 0
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
	const currentUserFieldIds = new Set(plugin.settings.userFields.map((f: UserMappedField) => f.id));
	config.fields = config.fields.filter(
		(f) => f.fieldType !== "user" || currentUserFieldIds.has(f.id)
	);
}
