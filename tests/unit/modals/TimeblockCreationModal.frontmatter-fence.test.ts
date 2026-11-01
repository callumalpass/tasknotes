import { observeTranslation as mockObserveTranslation } from "../../helpers/real-i18n";
import { App } from "obsidian";
import { TimeblockCreationModal } from "../../../src/modals/TimeblockCreationModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import { getDailyNote } from "obsidian-daily-notes-interface";

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

function createMockPlugin() {
	return {
		i18n: {
			translate: mockObserveTranslation(),
		},
		settings: {
			calendarViewSettings: {
				defaultTimeblockColor: "#8b5cf6",
				timeblockAttachmentSearchOrder: "name",
			},
		},
		cacheManager: {
			getAllTasks: jest.fn(async () => []),
		},
		emitter: {
			trigger: jest.fn(),
		},
	} as any;
}

describe("TimeblockCreationModal frontmatter fence detection", () => {
	let app: App;

	beforeEach(() => {
		MockObsidian.reset();
		app = MockObsidian.createMockApp() as unknown as App;
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		document.body.innerHTML = "";
	});

	it("does not corrupt the daily note when a frontmatter value contains '---' mid-line", async () => {
		// Regression test: finding the end of frontmatter by searching for any
		// "---" substring used to pick the "---" embedded in this description
		// value instead of the real closing fence, corrupting the file on save.
		const existingContent =
			'---\ndescription: "Section A --- Section B"\n---\n\n# Daily Note Content\n';
		const dailyNote = await app.vault.create("Daily/2026-05-16.md", existingContent);
		(getDailyNote as jest.Mock).mockReturnValue(dailyNote);

		const plugin = createMockPlugin();
		const modal = new TimeblockCreationModal(app, plugin, {
			date: "2026-05-16",
			startTime: "10:00",
			endTime: "10:30",
		});

		modal.onOpen();
		(modal as any).titleInput.value = "Focus block";
		(modal as any).startTimeInput.value = "10:00";
		(modal as any).endTimeInput.value = "10:30";
		await (modal as any).handleSubmit();

		const finalContent = await app.vault.read(dailyNote);
		expect(finalContent).toContain("description: Section A --- Section B");
		expect(finalContent).toContain("# Daily Note Content");
		expect(finalContent).toContain("Focus block");
	});
});
