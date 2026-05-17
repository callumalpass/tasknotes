import { generateTaskFilename } from "../../../src/utils/filenameGenerator";
import { TaskNotesSettings } from "../../../src/types/settings";

const UUID_V4_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const baseContext = {
	title: "Test Task",
	priority: "normal",
	status: "open",
};

function createSettings(
	overrides: Partial<TaskNotesSettings> = {}
): TaskNotesSettings {
	return {
		taskFilenameFormat: "uuid",
		storeTitleInFilename: false,
		customFilenameTemplate: "",
		...overrides,
	} as TaskNotesSettings;
}

describe("filenameGenerator - UUID v4 format (issue #791)", () => {
	it("generates a valid UUID v4 when format is uuid", () => {
		const filename = generateTaskFilename(baseContext, createSettings());

		expect(filename).toMatch(UUID_V4_REGEX);
	});

	it("generates unique UUIDs for each call", () => {
		const settings = createSettings();

		const filenames = new Set([
			generateTaskFilename(baseContext, settings),
			generateTaskFilename(baseContext, settings),
			generateTaskFilename(baseContext, settings),
		]);

		expect(filenames.size).toBe(3);
	});

	it("ignores the task title when UUID format is selected", () => {
		const filename = generateTaskFilename(
			{
				...baseContext,
				title: "My Important Task",
			},
			createSettings()
		);

		expect(filename).not.toContain("My");
		expect(filename).not.toContain("Important");
		expect(filename).not.toContain("Task");
		expect(filename).toMatch(UUID_V4_REGEX);
	});

	it("uses the title instead of UUID when storeTitleInFilename is true", () => {
		const filename = generateTaskFilename(
			{
				...baseContext,
				title: "My Task Title",
			},
			createSettings({ storeTitleInFilename: true })
		);

		expect(filename).toBe("My Task Title");
	});
});

describe("filenameGenerator - UUID custom template variable", () => {
	it("supports the uuid variable in custom templates", () => {
		const filename = generateTaskFilename(
			baseContext,
			createSettings({
				taskFilenameFormat: "custom",
				customFilenameTemplate: "{{uuid}}",
			})
		);

		expect(filename).toMatch(UUID_V4_REGEX);
	});

	it("combines UUID with other variables", () => {
		const filename = generateTaskFilename(
			{
				...baseContext,
				title: "My Task",
			},
			createSettings({
				taskFilenameFormat: "custom",
				customFilenameTemplate: "{{titleKebab}}-{{uuid}}",
			})
		);

		expect(filename).toMatch(
			/^my-task-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);
	});

	it("generates unique UUIDs when using the template variable", () => {
		const settings = createSettings({
			taskFilenameFormat: "custom",
			customFilenameTemplate: "{{uuid}}",
		});

		const filename1 = generateTaskFilename(baseContext, settings);
		const filename2 = generateTaskFilename(baseContext, settings);

		expect(filename1).not.toBe(filename2);
	});
});
