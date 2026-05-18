import { Decoration } from "@codemirror/view";
import { buildConvertButtonDecorations } from "../../../src/editor/InstantConvertButtons";
import { InstantTaskConvertService } from "../../../src/services/InstantTaskConvertService";
import { TasksPluginParser } from "../../../src/utils/TasksPluginParser";
import { PluginFactory } from "../../helpers/mock-factories";

type MockLine = {
	number: number;
	from: number;
	to: number;
	text: string;
};

function createMockView(lines: string[]) {
	const mockLines: MockLine[] = [];
	let offset = 0;

	for (let index = 0; index < lines.length; index++) {
		const text = lines[index];
		mockLines.push({
			number: index + 1,
			from: offset,
			to: offset + text.length,
			text,
		});
		offset += text.length + 1;
	}

	const doc = {
		lines: mockLines.length,
		length: Math.max(0, offset - 1),
		line: (lineNumber: number) => mockLines[lineNumber - 1],
		lineAt: (position: number) =>
			mockLines.find((line) => line.from <= position && line.to >= position) ??
			mockLines[mockLines.length - 1],
	};

	return {
		state: { doc },
		visibleRanges: [{ from: 0, to: doc.length }],
	};
}

function createService(preserveCheckboxOnConvert = false) {
	const plugin = PluginFactory.createMockPlugin({
		settings: {
			enableInstantTaskConvert: true,
			enableNaturalLanguageInput: false,
			preserveCheckboxOnConvert,
			useDefaultsOnInstantConvert: false,
			taskIdentificationMethod: "tag",
			taskTag: "task",
			taskCreationDefaults: {
				defaultContexts: "",
				defaultTags: "",
				defaultProjects: "",
				defaultPriority: "none",
				defaultTaskStatus: "none",
				defaultTimeEstimate: 0,
				defaultRecurrence: "none",
				defaultReminders: [],
			},
		},
	});

	plugin.app.fileManager.generateMarkdownLink = jest.fn(
		(file: { basename: string }) => `[[${file.basename}]]`
	);
	plugin.app.workspace.getActiveFile = jest.fn(() => ({ path: "Notes/source.md" }));

	return {
		plugin,
		service: new InstantTaskConvertService(plugin as any, {} as any, {} as any),
	};
}

describe("Issue #552: instant convert buttons in callouts", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("parses checkbox tasks inside callout blockquotes", () => {
		const parsed = TasksPluginParser.parseTaskLine("> - [ ] Callout task #work");

		expect(parsed.isTaskLine).toBe(true);
		expect(parsed.parsedData?.title).toBe("Callout task");
		expect(parsed.parsedData?.tags).toEqual(["work"]);
	});

	it("adds a convert button decoration for a callout checkbox task", () => {
		const widgetSpy = jest.spyOn(Decoration, "widget");
		const { plugin } = createService();

		buildConvertButtonDecorations(
			createMockView(["> [!todo]", "> - [ ] Callout task"]),
			plugin as any
		);

		expect(widgetSpy).toHaveBeenCalledTimes(1);
	});

	it("keeps converted task links inside the callout list", async () => {
		const { service } = createService();
		const originalLine = "> - [ ] Callout task";
		const editor = {
			lineCount: jest.fn(() => 1),
			getLine: jest.fn(() => originalLine),
			replaceRange: jest.fn(),
		};
		const file = { path: "Tasks/callout-task.md", basename: "Callout task" };

		const result = await (service as any).replaceOriginalTaskLines(
			editor,
			{
				taskLine: originalLine,
				details: "",
				startLine: 0,
				endLine: 0,
				originalContent: [originalLine],
			},
			file,
			"Callout task"
		);

		expect(result.success).toBe(true);
		expect(editor.replaceRange).toHaveBeenCalledWith(
			"> - [[Callout task]]",
			{ line: 0, ch: 0 },
			{ line: 0, ch: originalLine.length }
		);
	});

	it("preserves callout checkboxes when the preserve-checkbox setting is enabled", async () => {
		const { service } = createService(true);
		const originalLine = "> - [ ] Callout task";
		const editor = {
			lineCount: jest.fn(() => 1),
			getLine: jest.fn(() => originalLine),
			replaceRange: jest.fn(),
		};
		const file = { path: "Tasks/callout-task.md", basename: "Callout task" };

		const result = await (service as any).replaceOriginalTaskLines(
			editor,
			{
				taskLine: originalLine,
				details: "",
				startLine: 0,
				endLine: 0,
				originalContent: [originalLine],
			},
			file,
			"Callout task"
		);

		expect(result.success).toBe(true);
		expect(editor.replaceRange).toHaveBeenCalledWith(
			"> - [ ] [[Callout task]]",
			{ line: 0, ch: 0 },
			{ line: 0, ch: originalLine.length }
		);
	});
});
