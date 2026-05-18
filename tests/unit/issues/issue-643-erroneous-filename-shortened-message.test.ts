import {
	generateTaskFilename,
	shouldShowFilenameShortenedNotice,
} from "../../../src/utils/filenameGenerator";
import type { TaskNotesSettings } from "../../../src/types/settings";

function makeSettings(
	overrides: Partial<Pick<
		TaskNotesSettings,
		"taskFilenameFormat" | "customFilenameTemplate" | "storeTitleInFilename"
	>> = {}
): Pick<
	TaskNotesSettings,
	"taskFilenameFormat" | "customFilenameTemplate" | "storeTitleInFilename"
> {
	return {
		taskFilenameFormat: "custom",
		customFilenameTemplate: "task-{year}{month}{day}{hour}{minute}",
		storeTitleInFilename: false,
		...overrides,
	};
}

describe("Issue #643 - filename shortened notice", () => {
	it("does not warn for a custom template that legitimately starts with task-", () => {
		const settings = makeSettings();
		const generatedFilename = generateTaskFilename(
			{
				title: "Buy groceries",
				priority: "normal",
				status: "todo",
				date: new Date(2026, 1, 9, 14, 35, 0),
			},
			settings as TaskNotesSettings
		);

		expect(generatedFilename).toBe("task-202602091435");
		expect(
			shouldShowFilenameShortenedNotice(settings, "Buy groceries", generatedFilename)
		).toBe(false);
	});

	it("does not warn for non-title filename formats that happen to use task- prefixes", () => {
		const settings = makeSettings({
			taskFilenameFormat: "custom",
			customFilenameTemplate: "task-{timestamp}",
			storeTitleInFilename: false,
		});

		expect(shouldShowFilenameShortenedNotice(settings, "Any title", "task-202605181120")).toBe(
			false
		);
	});

	it("still warns for title-based filenames that fall back to task-*", () => {
		const settings = makeSettings({
			taskFilenameFormat: "title",
			customFilenameTemplate: "",
			storeTitleInFilename: true,
		});

		expect(shouldShowFilenameShortenedNotice(settings, "A normal task title", "task-lx7")).toBe(
			true
		);
	});

	it("does not warn when the title-derived filename matches the title", () => {
		const settings = makeSettings({
			taskFilenameFormat: "title",
			customFilenameTemplate: "",
			storeTitleInFilename: true,
		});

		expect(
			shouldShowFilenameShortenedNotice(
				settings,
				"A normal task title",
				"A normal task title"
			)
		).toBe(false);
	});
});
