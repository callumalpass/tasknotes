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
	const translations: Record<string, string> = {
		"modals.timeblockCreation.heading": "Create timeblock",
		"modals.timeblockCreation.dateLabel": "Date:",
		"modals.timeblockCreation.titleLabel": "Title",
		"modals.timeblockCreation.titleDesc": "Title for your timeblock",
		"modals.timeblockCreation.titlePlaceholder": "e.g., Deep work session",
		"modals.timeblockCreation.startTimeLabel": "Start time",
		"modals.timeblockCreation.startTimeDesc": "When the timeblock starts",
		"modals.timeblockCreation.startTimePlaceholder": "09:00",
		"modals.timeblockCreation.endTimeLabel": "End time",
		"modals.timeblockCreation.endTimeDesc": "When the timeblock ends",
		"modals.timeblockCreation.endTimePlaceholder": "10:00",
		"modals.timeblockCreation.descriptionLabel": "Description",
		"modals.timeblockCreation.descriptionDesc": "Optional description for the timeblock",
		"modals.timeblockCreation.descriptionPlaceholder": "Focus on new features",
		"modals.timeblockCreation.colorLabel": "Color",
		"modals.timeblockCreation.colorDesc": "Optional color for the timeblock",
		"modals.timeblockCreation.colorPlaceholder": "#8b5cf6",
		"modals.timeblockCreation.attachmentsLabel": "Attachments",
		"modals.timeblockCreation.attachmentsDesc": "Files or notes to link to this timeblock",
		"modals.timeblockCreation.addAttachmentButton": "Add attachment",
		"modals.timeblockCreation.addAttachmentTooltip": "Add a file attachment",
		"modals.timeblockCreation.createButton": "Create timeblock",
		"common.cancel": "Cancel",
	};

	return {
		i18n: {
			translate: (key: string) => translations[key] || key,
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

function findDirectChild(container: HTMLElement, text: string): Element | undefined {
	return Array.from(container.children).find((child) => {
		const childText = child.textContent || "";
		return childText.includes(text);
	});
}

describe("Issue #1767: timeblock creation time row alignment", () => {
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

	it("renders start and end time settings as matching top-level rows", () => {
		const modal = new TimeblockCreationModal(app, createMockPlugin(), {
			date: "2026-05-16",
			startTime: "10:00",
			endTime: "10:30",
		});

		modal.onOpen();

		const startRow = findDirectChild(modal.contentEl, "Start time");
		const endRow = findDirectChild(modal.contentEl, "End time");

		expect(modal.contentEl.querySelector(".timeblock-time-container")).toBeNull();
		expect(startRow).toBeDefined();
		expect(endRow).toBeDefined();
		expect(startRow?.textContent).not.toContain("End time");
		expect(endRow?.textContent).not.toContain("Start time");
		expect(startRow?.parentElement).toBe(modal.contentEl);
		expect(endRow?.parentElement).toBe(modal.contentEl);
		expect(startRow?.nextElementSibling).toBe(endRow);
	});

	it("notifies callers after saving a created timeblock", async () => {
		const dailyNote = await app.vault.create("Daily/2026-05-16.md", "---\n---\n");
		(getDailyNote as jest.Mock).mockReturnValue(dailyNote);
		const onCreated = jest.fn();
		const plugin = createMockPlugin();
		const modal = new TimeblockCreationModal(app, plugin, {
			date: "2026-05-16",
			startTime: "10:00",
			endTime: "10:30",
			onCreated,
		});

		modal.onOpen();
		(modal as any).titleInput.value = "Focus block";
		(modal as any).startTimeInput.value = "10:00";
		(modal as any).endTimeInput.value = "10:30";
		await (modal as any).handleSubmit();

		expect(plugin.emitter.trigger).toHaveBeenCalledWith("data-changed");
		expect(onCreated).toHaveBeenCalledTimes(1);
		const createdPayload = onCreated.mock.calls[0][0];
		expect(createdPayload.timeblock).toMatchObject({
			id: expect.any(String),
			title: "Focus block",
			startTime: "10:00",
			endTime: "10:30",
		});
		expect(createdPayload.date).toBe("2026-05-16");
		expect(createdPayload.dailyNote.path).toBe(dailyNote.path);
	});
});
