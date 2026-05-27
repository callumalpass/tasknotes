import { InstantTaskConvertService } from "../../../src/services/InstantTaskConvertService";
import { PluginFactory } from "../../helpers/mock-factories";
import { TFile } from "../../__mocks__/obsidian";

describe("Issue #1953: inline conversion link aliases", () => {
	let service: InstantTaskConvertService;
	let plugin: any;

	beforeEach(() => {
		plugin = PluginFactory.createMockPlugin({
			settings: {
				...PluginFactory.createMockPlugin().settings,
				preserveCheckboxOnConvert: false,
			},
		});

		plugin.app.workspace.getActiveFile = jest
			.fn()
			.mockReturnValue({ path: "Notes/Project.md" });
		service = new InstantTaskConvertService(
			plugin,
			plugin.statusManager,
			plugin.priorityManager
		);
	});

	it("strips nested wikilink markup from the replacement wikilink alias", async () => {
		const originalLine =
			"- [ ] Prepare presentation for [[John Smith]] promotion to L5 +[[John Smith Career]]";
		const taskFile = {
			path: "Tasks/Prepare presentation for John Smith promotion to L5.md",
			basename: "Prepare presentation for John Smith promotion to L5",
		} as TFile;
		const editor = {
			lineCount: jest.fn().mockReturnValue(1),
			getLine: jest.fn().mockReturnValue(originalLine),
			replaceRange: jest.fn(),
		};

		plugin.app.fileManager.generateMarkdownLink = jest
			.fn()
			.mockReturnValue(
				"[[Prepare presentation for John Smith promotion to L5|Prepare presentation for [[John Smith]] promotion to L5]]"
			);

		const result = await (service as any).replaceOriginalTaskLines(
			editor,
			{
				taskLine: originalLine,
				details: "",
				startLine: 0,
				endLine: 0,
				originalContent: [originalLine],
			},
			taskFile,
			"Prepare presentation for [[John Smith]] promotion to L5"
		);

		expect(result.success).toBe(true);
		expect(editor.replaceRange).toHaveBeenCalledWith(
			"- [[Prepare presentation for John Smith promotion to L5|Prepare presentation for John Smith promotion to L5]]",
			{ line: 0, ch: 0 },
			{ line: 0, ch: originalLine.length }
		);
	});

	it("uses the same alias sanitization for batch conversion link text", () => {
		const originalLine = "* [ ] Review [[Projects/Q2|Q2]] planning";
		const taskFile = {
			path: "Tasks/Review Q2 planning.md",
			basename: "Review Q2 planning",
		} as TFile;

		plugin.app.fileManager.generateMarkdownLink = jest
			.fn()
			.mockReturnValue("[[Tasks/Review Q2 planning|Review [[Projects/Q2|Q2]] planning]]");

		expect((service as any).generateLinkText(originalLine, taskFile)).toBe(
			"* [[Tasks/Review Q2 planning|Review Q2 planning]]"
		);
	});
});
