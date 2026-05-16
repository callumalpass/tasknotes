import {
	getTimeblockCreationErrorMessage,
	readDailyNotesForTimeblockCreation,
} from "../../../src/modals/TimeblockCreationModal";

jest.mock("obsidian");
jest.mock("obsidian-daily-notes-interface", () => ({
	appHasDailyNotesPluginLoaded: jest.fn(() => true),
	createDailyNote: jest.fn(),
	getAllDailyNotes: jest.fn(() => ({})),
	getDailyNote: jest.fn(),
}));
jest.mock("../../../src/modals/FileSelectorModal", () => ({
	openFileSelector: jest.fn(),
}));
jest.mock("../../../src/modals/TaskSelectorWithCreateModal", () => ({
	openTaskSelector: jest.fn(),
}));

describe("Issue #1674: timeblock Daily Notes folder errors", () => {
	it("wraps Daily Notes lookup failures with setup guidance", () => {
		const readDailyNotes = jest.fn(() => {
			throw new Error("OA: Failed to find daily notes folder");
		});

		expect(() => readDailyNotesForTimeblockCreation(readDailyNotes)).toThrow(
			"Failed to read daily notes: OA: Failed to find daily notes folder. Check the Daily Notes core plugin settings and make sure the configured daily notes folder exists."
		);
		expect(readDailyNotes).toHaveBeenCalledTimes(1);
	});

	it("returns the Daily Notes lookup when the core plugin can read it", () => {
		const dailyNotes = {};
		const readDailyNotes = jest.fn(() => dailyNotes);

		expect(readDailyNotesForTimeblockCreation(readDailyNotes)).toBe(dailyNotes);
		expect(readDailyNotes).toHaveBeenCalledTimes(1);
	});

	it("surfaces the underlying setup error in the create-timeblock notice", () => {
		const message = getTimeblockCreationErrorMessage(
			new Error(
				"Failed to read daily notes: OA: Failed to find daily notes folder. Check the Daily Notes core plugin settings and make sure the configured daily notes folder exists."
			)
		);

		expect(message).toBe(
			"Failed to create timeblock: Failed to read daily notes: OA: Failed to find daily notes folder. Check the Daily Notes core plugin settings and make sure the configured daily notes folder exists."
		);
	});
});
