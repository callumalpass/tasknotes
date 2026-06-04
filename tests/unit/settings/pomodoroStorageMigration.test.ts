import { renderFeaturesTab } from "../../../src/settings/tabs/featuresTab";
import { configureDropdownSetting } from "../../../src/settings/components/settingHelpers";
import { showStorageLocationConfirmationModal } from "../../../src/modals/StorageLocationConfirmationModal";
import type TaskNotesPlugin from "../../../src/main";

jest.mock("../../../src/settings/components/settingHelpers", () => ({
	createSettingGroup: jest.fn(
		(
			_container: HTMLElement,
			options: { heading: string },
			addSettings: (group: { addSetting: (callback: (setting: unknown) => void) => unknown }) => void
		) => {
			const group = {
				addSetting: jest.fn((callback: (setting: unknown) => void) => {
					callback({});
					return group;
				}),
			};

			if (options.heading === "settings.features.pomodoro.header") {
				addSettings(group);
			}

			return group;
		}
	),
	configureTextSetting: jest.fn((setting: unknown) => setting),
	configureToggleSetting: jest.fn((setting: unknown) => setting),
	configureDropdownSetting: jest.fn((setting: unknown) => setting),
	configureNumberSetting: jest.fn((setting: unknown) => setting),
	configureButtonSetting: jest.fn((setting: unknown) => setting),
}));

jest.mock("../../../src/modals/StorageLocationConfirmationModal", () => ({
	showStorageLocationConfirmationModal: jest.fn(),
}));

function createPlugin(pluginHistory: unknown[]) {
	return {
		settings: {
			pomodoroStorageLocation: "plugin",
			pomodoroSoundEnabled: false,
			inlineVisibleProperties: [],
			userFields: [],
		},
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		loadData: jest.fn(async () => ({ pomodoroHistory: pluginHistory })),
		pomodoroService: {
			migrateTodailyNotes: jest.fn().mockResolvedValue(undefined),
		},
		fieldMapper: {
			toUserField: jest.fn((key: string) => key),
		},
	} as unknown as TaskNotesPlugin;
}

function getDataStorageDropdownOptions() {
	const dataStorageCall = (configureDropdownSetting as jest.Mock).mock.calls.find(
		([, options]) => options.name === "settings.features.dataStorage.name"
	);

	if (!dataStorageCall) {
		throw new Error("Data storage dropdown was not rendered");
	}

	return dataStorageCall[1] as { setValue: (value: string) => Promise<void> };
}

describe("Pomodoro storage migration setting", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(showStorageLocationConfirmationModal as jest.Mock).mockResolvedValue(true);
	});

	it("migrates existing plugin history before switching to daily notes storage", async () => {
		const plugin = createPlugin([{ id: "session-1" }]);
		const save = jest.fn();

		renderFeaturesTab(document.createElement("div"), plugin, save);
		await getDataStorageDropdownOptions().setValue("daily-notes");

		expect(showStorageLocationConfirmationModal).toHaveBeenCalledWith(plugin, true);
		expect(plugin.pomodoroService?.migrateTodailyNotes).toHaveBeenCalledTimes(1);
		expect(plugin.settings.pomodoroStorageLocation).toBe("daily-notes");
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("does not switch storage when migration fails", async () => {
		const plugin = createPlugin([{ id: "session-1" }]);
		const save = jest.fn();
		(plugin.pomodoroService?.migrateTodailyNotes as jest.Mock).mockRejectedValueOnce(
			new Error("Daily notes unavailable")
		);

		renderFeaturesTab(document.createElement("div"), plugin, save);
		await getDataStorageDropdownOptions().setValue("daily-notes");

		expect(plugin.settings.pomodoroStorageLocation).toBe("plugin");
		expect(save).not.toHaveBeenCalled();
	});

	it("validates daily notes storage before switching without existing plugin history", async () => {
		const plugin = createPlugin([]);
		const save = jest.fn();

		renderFeaturesTab(document.createElement("div"), plugin, save);
		await getDataStorageDropdownOptions().setValue("daily-notes");

		expect(showStorageLocationConfirmationModal).toHaveBeenCalledWith(plugin, false);
		expect(plugin.pomodoroService?.migrateTodailyNotes).toHaveBeenCalledTimes(1);
		expect(plugin.settings.pomodoroStorageLocation).toBe("daily-notes");
		expect(save).toHaveBeenCalledTimes(1);
	});
});
