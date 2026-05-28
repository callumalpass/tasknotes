import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { buildSettingsFromLoadedData } from "../../../src/settings/settingsPersistence";
import type { TaskNotesSettings } from "../../../src/types/settings";
import { generateTaskFilename } from "../../../src/utils/filenameGenerator";

describe("Issue #1961 - custom filename template default", () => {
	it("prefills the custom filename template with double-brace syntax", () => {
		expect(DEFAULT_SETTINGS.customFilenameTemplate).toBe("{{title}}");

		const filename = generateTaskFilename(
			{
				title: "Review inbox",
				priority: "normal",
				status: "open",
				date: new Date(2026, 4, 28, 14, 35, 0),
			},
			{
				...DEFAULT_SETTINGS,
				storeTitleInFilename: false,
				taskFilenameFormat: "custom",
			} as TaskNotesSettings
		);

		expect(filename).toBe("Review inbox");
	});

	it("migrates the unused legacy default without rewriting active custom templates", () => {
		const inactiveLegacyDefault = buildSettingsFromLoadedData({
			taskFilenameFormat: "zettel",
			customFilenameTemplate: "{title}",
		});
		expect(inactiveLegacyDefault.settings.customFilenameTemplate).toBe("{{title}}");
		expect(inactiveLegacyDefault.shouldPersistMigratedSettings).toBe(true);

		const activeCustomTemplate = buildSettingsFromLoadedData({
			taskFilenameFormat: "custom",
			customFilenameTemplate: "{title}",
		});
		expect(activeCustomTemplate.settings.customFilenameTemplate).toBe("{title}");
	});
});
