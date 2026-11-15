import { settingsFixture } from "../../helpers/native-settings";
import { showStorageLocationConfirmationModal } from "../../../src/modals/StorageLocationConfirmationModal";

jest.mock("../../../src/modals/StorageLocationConfirmationModal", () => ({ showStorageLocationConfirmationModal: jest.fn() }));

describe("Native Pomodoro storage migration setting", () => {
	beforeEach(() => { jest.clearAllMocks(); (showStorageLocationConfirmationModal as jest.Mock).mockResolvedValue(true); });
	it.each([true, false])("validates and migrates before switching, existing history: %s", async hasHistory => {
		const { plugin, tab } = settingsFixture();
		plugin.settings.pomodoroStorageLocation = "plugin";
		(plugin.loadData as jest.Mock).mockResolvedValue({ pomodoroHistory: hasHistory ? [{ id: "session-1" }] : [] });
		tab.getSettingDefinitions();
		await tab.setControlValue("pomodoroStorageLocation", "daily-notes");
		expect(showStorageLocationConfirmationModal).toHaveBeenCalledWith(plugin, hasHistory);
		expect(plugin.pomodoroService.migrateTodailyNotes).toHaveBeenCalledTimes(1);
		expect(plugin.settings.pomodoroStorageLocation).toBe("daily-notes");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});
	it("keeps the original location if migration fails", async () => {
		const { plugin, tab } = settingsFixture(); plugin.settings.pomodoroStorageLocation = "plugin";
		(plugin.pomodoroService.migrateTodailyNotes as jest.Mock).mockRejectedValueOnce(new Error("Daily notes unavailable"));
		tab.getSettingDefinitions();
		await expect(tab.setControlValue("pomodoroStorageLocation", "daily-notes")).rejects.toThrow("Daily notes unavailable");
		expect(plugin.settings.pomodoroStorageLocation).toBe("plugin"); expect(plugin.saveSettings).not.toHaveBeenCalled();
	});
	it("keeps the original location if confirmation is cancelled", async () => {
		const { plugin, tab } = settingsFixture(); plugin.settings.pomodoroStorageLocation = "plugin";
		(showStorageLocationConfirmationModal as jest.Mock).mockResolvedValue(false);
		tab.getSettingDefinitions(); await tab.setControlValue("pomodoroStorageLocation", "daily-notes");
		expect(plugin.settings.pomodoroStorageLocation).toBe("plugin"); expect(plugin.saveSettings).not.toHaveBeenCalled();
	});
});
