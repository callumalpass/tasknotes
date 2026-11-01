import { observeTranslation as mockObserveTranslation } from "../../helpers/real-i18n";
import { App } from "obsidian";
import { TimeblockInfoModal, TimeBlock } from "../../../src/modals/TimeblockInfoModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import { getDailyNote } from "obsidian-daily-notes-interface";

jest.mock("obsidian-daily-notes-interface", () => ({
	appHasDailyNotesPluginLoaded: jest.fn(() => true),
	getAllDailyNotes: jest.fn(() => ({})),
	getDailyNote: jest.fn(),
}));

function createMockPlugin() {
	return {
		i18n: {
			translate: mockObserveTranslation(),
		},
		settings: {
			calendarViewSettings: {
				defaultTimeblockColor: "#8b5cf6",
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

const existingTimeblock: TimeBlock = {
	id: "tb-1",
	title: "Standup",
	startTime: "09:00",
	endTime: "09:15",
};

function dailyNoteContent(): string {
	// `description` contains a "---" mid-line, the exact shape that used to
	// make the fragile fence detection pick the wrong end of frontmatter.
	return `---
description: "Section A --- Section B"
timeblocks:
  - id: tb-1
    title: Standup
    startTime: "09:00"
    endTime: "09:15"
---

# Daily Note Content
`;
}

describe("TimeblockInfoModal frontmatter fence detection", () => {
	let app: App;

	beforeEach(() => {
		MockObsidian.reset();
		app = MockObsidian.createMockApp() as unknown as App;
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("preserves unrelated frontmatter and body when updating a timeblock", async () => {
		const dailyNote = await app.vault.create("Daily/2026-05-16.md", dailyNoteContent());
		(getDailyNote as jest.Mock).mockReturnValue(dailyNote);

		const plugin = createMockPlugin();
		const modal = new TimeblockInfoModal(
			app,
			plugin,
			{ ...existingTimeblock },
			new Date("2026-05-16"),
			"2026-05-16"
		);
		(modal as any).timeblock.title = "Standup (updated)";

		await (modal as any).updateTimeblockInDailyNote();

		const finalContent = await app.vault.read(dailyNote);
		expect(finalContent).toContain("description: Section A --- Section B");
		expect(finalContent).toContain("# Daily Note Content");
		expect(finalContent).toContain("Standup (updated)");
	});

	it("preserves unrelated frontmatter and body when deleting a timeblock", async () => {
		const dailyNote = await app.vault.create("Daily/2026-05-16.md", dailyNoteContent());
		(getDailyNote as jest.Mock).mockReturnValue(dailyNote);

		const plugin = createMockPlugin();
		const modal = new TimeblockInfoModal(
			app,
			plugin,
			{ ...existingTimeblock },
			new Date("2026-05-16"),
			"2026-05-16"
		);

		await (modal as any).deleteTimeblockFromDailyNote();

		const finalContent = await app.vault.read(dailyNote);
		expect(finalContent).toContain("description: Section A --- Section B");
		expect(finalContent).toContain("# Daily Note Content");
		expect(finalContent).not.toContain("Standup");
	});
});
