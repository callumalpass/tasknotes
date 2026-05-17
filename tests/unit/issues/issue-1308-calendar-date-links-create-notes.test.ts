import { Notice, type TFile } from "obsidian";
import {
	appHasDailyNotesPluginLoaded,
	createDailyNote,
	getAllDailyNotes,
	getDailyNote,
} from "obsidian-daily-notes-interface";
import { handleDateTitleClick } from "../../../src/bases/calendar-core";

jest.mock("obsidian");
jest.mock("obsidian-daily-notes-interface", () => ({
	appHasDailyNotesPluginLoaded: jest.fn(),
	createDailyNote: jest.fn(),
	getAllDailyNotes: jest.fn(),
	getDailyNote: jest.fn(),
}));

type MockPlugin = {
	app: {
		workspace: {
			getLeaf: jest.Mock;
		};
	};
	i18n: {
		translate: jest.Mock;
	};
};

const mockedAppHasDailyNotesPluginLoaded =
	appHasDailyNotesPluginLoaded as jest.MockedFunction<typeof appHasDailyNotesPluginLoaded>;
const mockedCreateDailyNote = createDailyNote as jest.MockedFunction<typeof createDailyNote>;
const mockedGetAllDailyNotes = getAllDailyNotes as jest.MockedFunction<typeof getAllDailyNotes>;
const mockedGetDailyNote = getDailyNote as jest.MockedFunction<typeof getDailyNote>;

function createDailyNoteFile(path: string): TFile {
	return {
		path,
		name: path.split("/").pop() ?? path,
		basename: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
		extension: "md",
	} as TFile;
}

function createPlugin(openFile = jest.fn().mockResolvedValue(undefined)): MockPlugin {
	return {
		app: {
			workspace: {
				getLeaf: jest.fn(() => ({ openFile })),
			},
		},
		i18n: {
			translate: jest.fn((key: string) => {
				if (key === "views.basesCalendar.notices.noDailyNoteForDate") {
					return "No daily note exists for this date.";
				}
				return key;
			}),
		},
	};
}

describe("Issue #1308: Calendar date links creating unwanted daily notes", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedAppHasDailyNotesPluginLoaded.mockReturnValue(true);
		mockedGetAllDailyNotes.mockReturnValue({});
		(window as unknown as { moment: jest.Mock }).moment = jest.fn((input: unknown) => ({
			input,
		}));
	});

	it("keeps the existing behavior by creating missing daily notes by default", async () => {
		const dailyNote = createDailyNoteFile("Daily/2026-03-16.md");
		const openFile = jest.fn().mockResolvedValue(undefined);
		const plugin = createPlugin(openFile);
		mockedGetDailyNote.mockReturnValue(null);
		mockedCreateDailyNote.mockResolvedValue(dailyNote);

		await handleDateTitleClick(new Date(2026, 2, 16), plugin as never);

		expect(mockedCreateDailyNote).toHaveBeenCalledTimes(1);
		expect(openFile).toHaveBeenCalledWith(dailyNote);
		expect(Notice).not.toHaveBeenCalledWith("No daily note exists for this date.");
	});

	it("does not create a missing daily note when date-link creation is disabled", async () => {
		const openFile = jest.fn().mockResolvedValue(undefined);
		const plugin = createPlugin(openFile);
		mockedGetDailyNote.mockReturnValue(null);

		await handleDateTitleClick(new Date(2026, 2, 16), plugin as never, {
			createIfMissing: false,
		});

		expect(mockedCreateDailyNote).not.toHaveBeenCalled();
		expect(openFile).not.toHaveBeenCalled();
		expect(Notice).toHaveBeenCalledWith("No daily note exists for this date.");
	});

	it("opens existing daily notes even when date-link creation is disabled", async () => {
		const dailyNote = createDailyNoteFile("Daily/2026-03-16.md");
		const openFile = jest.fn().mockResolvedValue(undefined);
		const plugin = createPlugin(openFile);
		mockedGetDailyNote.mockReturnValue(dailyNote);

		await handleDateTitleClick(new Date(2026, 2, 16), plugin as never, {
			createIfMissing: false,
		});

		expect(mockedCreateDailyNote).not.toHaveBeenCalled();
		expect(openFile).toHaveBeenCalledWith(dailyNote);
	});
});
