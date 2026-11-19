import { getTaskFilenameNotice } from "../../../src/utils/filenameGenerator";

const titleFilenames = {
	storeTitleInFilename: true,
	taskFilenameFormat: "zettel" as const,
};

describe("Issue #2276 - notice when the filename drops title characters", () => {
	it("reports characters removed from a title-based filename", () => {
		expect(
			getTaskFilenameNotice(
				titleFilenames,
				"Review https://tasknotes.dev/obsidian/",
				"Review httpstasknotes.devobsidian"
			)
		).toBe("sanitized");
		expect(
			getTaskFilenameNotice(titleFilenames, 'Plan a<b> | d? e* f\\g: h', "Plan ab d e fg h")
		).toBe("sanitized");
	});

	it("still reports sanitization when a collision suffix was also added", () => {
		expect(getTaskFilenameNotice(titleFilenames, "Check A/B", "Check AB 2")).toBe("sanitized");
	});

	it("stays quiet for whitespace-only changes and collision suffixes", () => {
		expect(getTaskFilenameNotice(titleFilenames, "Buy  milk ", "Buy milk")).toBeNull();
		expect(getTaskFilenameNotice(titleFilenames, "Buy milk", "Buy milk 2")).toBeNull();
	});

	it("stays quiet when filenames are not based on the title", () => {
		expect(
			getTaskFilenameNotice(
				{ storeTitleInFilename: false, taskFilenameFormat: "zettel" },
				"Check A/B",
				"261101abc"
			)
		).toBeNull();
	});
});
