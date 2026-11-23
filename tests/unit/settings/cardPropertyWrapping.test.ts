import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import {
	buildSettingsFromLoadedData,
	buildSettingsDataForSave,
	type LoadedSettingsData,
} from "../../../src/settings/settingsPersistence";

describe("card property wrapping defaults", () => {
	it("enables wrapping in the default settings", () => {
		expect(DEFAULT_SETTINGS.wrapTaskCardProperties).toBe(true);
	});

	it.each([null, {}, { hideIdentifyingTagsInCards: true }])(
		"enables wrapping when no choice was saved (%p)",
		data => {
			expect(buildSettingsFromLoadedData(data).settings.wrapTaskCardProperties).toBe(true);
		}
	);

	it.each([false, true])("preserves a saved choice of %s through save and reload", value => {
		const { settings } = buildSettingsFromLoadedData({ wrapTaskCardProperties: value });
		expect(settings.wrapTaskCardProperties).toBe(value);
		const saved = buildSettingsDataForSave({}, settings);
		expect(saved.wrapTaskCardProperties).toBe(value);
		expect(buildSettingsFromLoadedData(saved as LoadedSettingsData).settings.wrapTaskCardProperties).toBe(value);
	});

	it("keeps inline wrapping off independently of the Bases wrapping default", () => {
		const { settings } = buildSettingsFromLoadedData(null);
		expect(settings.wrapTaskCardProperties).toBe(true);
		expect(settings.wrapInlineTaskProperties).toBe(false);
	});

	it("keeps separate saved choices for Bases and inline wrapping", () => {
		const { settings } = buildSettingsFromLoadedData({
			wrapTaskCardProperties: false,
			wrapInlineTaskProperties: true,
		});
		expect(settings.wrapTaskCardProperties).toBe(false);
		expect(settings.wrapInlineTaskProperties).toBe(true);
	});

	it("does not rewrite the saved choice while loading settings", () => {
		const data = { wrapTaskCardProperties: false };
		buildSettingsFromLoadedData(data);
		expect(data).toEqual({ wrapTaskCardProperties: false });
	});
});
