import { App } from "obsidian";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { extractTaskInfo } from "../../../src/utils/helpers";

describe("Issue #1434: title fallback after changing storeTitleInFilename", () => {
	let fieldMapper: FieldMapper;

	beforeEach(() => {
		fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
	});

	it("derives the title from the filename when a legacy task lacks a title property", () => {
		const frontmatter = {
			status: "open",
			priority: "normal",
			tags: ["task"],
		};

		const taskInfo = fieldMapper.mapFromFrontmatter(
			frontmatter,
			"tasks/Buy groceries.md",
			false
		);

		expect(taskInfo.title).toBe("Buy groceries");
	});

	it("keeps the explicit title property when it is present", () => {
		const frontmatter = {
			title: "Custom title",
			status: "open",
			tags: ["task"],
		};

		expect(
			fieldMapper.mapFromFrontmatter(frontmatter, "tasks/Different filename.md", true).title
		).toBe("Custom title");
		expect(
			fieldMapper.mapFromFrontmatter(frontmatter, "tasks/Different filename.md", false).title
		).toBe("Custom title");
	});

	it("falls back to the filename when the title property is empty or null", () => {
		expect(
			fieldMapper.mapFromFrontmatter(
				{ title: "", status: "open", tags: ["task"] },
				"tasks/Filename fallback.md",
				false
			).title
		).toBe("Filename fallback");
		expect(
			fieldMapper.mapFromFrontmatter(
				{ title: null, status: "open", tags: ["task"] },
				"tasks/Null title fallback.md",
				false
			).title
		).toBe("Null title fallback");
	});

	it("passes the filename fallback through complete task extraction", () => {
		const app = new App();
		const file = {
			path: "tasks/Schedule dentist appointment.md",
			name: "Schedule dentist appointment.md",
			basename: "Schedule dentist appointment",
			extension: "md",
		};

		jest.spyOn(app.metadataCache, "getFileCache").mockReturnValue({
			frontmatter: {
				status: "open",
				priority: "normal",
				tags: ["task"],
			},
		} as never);

		const taskInfo = extractTaskInfo(
			app,
			"---\nstatus: open\npriority: normal\ntags:\n  - task\n---\n",
			file.path,
			file as never,
			fieldMapper,
			false
		);

		expect(taskInfo?.title).toBe("Schedule dentist appointment");
		expect(taskInfo?.title).not.toBe("Untitled task");
	});
});
