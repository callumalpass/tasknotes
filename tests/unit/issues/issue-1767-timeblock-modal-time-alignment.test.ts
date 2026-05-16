import { App } from "obsidian";
import { TimeblockCreationModal } from "../../../src/modals/TimeblockCreationModal";
import { MockObsidian } from "../../__mocks__/obsidian";

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
});
