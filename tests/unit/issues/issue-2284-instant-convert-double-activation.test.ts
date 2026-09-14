import { InstantTaskConvertService } from "../../../src/services/InstantTaskConvertService";
import { PluginFactory } from "../../helpers/mock-factories";
import { TFile } from "../../helpers/obsidian-runtime";

describe("Issue #2284: repeated instant-convert activation", () => {
	it("creates at most one TaskNote while the same editor line is converting", async () => {
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				enableNaturalLanguageInput: false,
				preserveCheckboxOnConvert: false,
			},
		});
		const service = new InstantTaskConvertService(plugin as never, undefined as never, undefined as never);
		const editor = {
			lineCount: jest.fn(() => 1),
			getLine: jest.fn(() => "- [ ] Example task"),
			getSelection: jest.fn(() => ""),
			getValue: jest.fn(() => "- [[Example task]]"),
		} as never;
		const file = new TFile("TaskNotes/Tasks/Example task.md");
		let finishCreation!: (file: TFile) => void;
		const creation = new Promise<TFile>((resolve) => {
			finishCreation = resolve;
		});
		const createTaskFile = jest
			.spyOn(service as never, "createTaskFile" as never)
			.mockImplementation(() => creation as never);
		jest
			.spyOn(service as never, "replaceOriginalTaskLines" as never)
			.mockResolvedValue({ success: true } as never);
		jest
			.spyOn(service as never, "persistSourceNoteAfterReplacement" as never)
			.mockResolvedValue(null as never);
		jest
			.spyOn(service as never, "refreshTaskLinkOverlays" as never)
			.mockResolvedValue(undefined as never);

		const first = service.instantConvertTask(editor, 0);
		const second = service.instantConvertTask(editor, 0);

		expect(createTaskFile).toHaveBeenCalledTimes(1);

		finishCreation(file);
		await Promise.all([first, second]);
		expect(createTaskFile).toHaveBeenCalledTimes(1);
	});
});
