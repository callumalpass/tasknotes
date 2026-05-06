import { formatTitleForFilename, generateTaskFilename } from "../../../src/utils/filenameGenerator";
import { TaskNotesSettings } from "../../../src/types/settings";

describe("filenameGenerator title filename style", () => {
	const baseContext = {
		title: "Inventory possessions into keep, store, sell, donate, trash",
		priority: "normal",
		status: "open",
	};

	it("keeps readable title filenames by default", () => {
		expect(formatTitleForFilename(baseContext.title)).toBe(
			"Inventory possessions into keep, store, sell, donate, trash"
		);
	});

	it("can create lowercase snake_case title filenames", () => {
		expect(formatTitleForFilename(baseContext.title, "lowercase-snake")).toBe(
			"inventory_possessions_into_keep_store_sell_donate_trash"
		);
	});

	it("uses lowercase snake_case when storeTitleInFilename is enabled", () => {
		const settings = {
			storeTitleInFilename: true,
			taskFilenameFormat: "zettel",
			customFilenameTemplate: "{title}",
			taskTitleFormatting: {
				filenameStyle: "lowercase-snake",
			},
		} as TaskNotesSettings;

		expect(generateTaskFilename(baseContext, settings)).toBe(
			"inventory_possessions_into_keep_store_sell_donate_trash"
		);
	});

	it("uses lowercase snake_case for title filename format", () => {
		const settings = {
			storeTitleInFilename: false,
			taskFilenameFormat: "title",
			customFilenameTemplate: "{title}",
			taskTitleFormatting: {
				filenameStyle: "lowercase-snake",
			},
		} as TaskNotesSettings;

		expect(generateTaskFilename(baseContext, settings)).toBe(
			"inventory_possessions_into_keep_store_sell_donate_trash"
		);
	});
});
