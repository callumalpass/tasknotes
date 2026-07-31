import type { App } from "obsidian";
import { TaskEditModal } from "../../../src/modals/TaskEditModal";
import type { TaskInfo } from "../../../src/types";
import { MockObsidian } from "../../helpers/obsidian-runtime";

const createMockApp = (mockApp: unknown): App => mockApp as App;

const translations: Record<string, string> = {
	"modals.taskEdit.sections.taskInfo": "Task information",
	"modals.taskEdit.metadata.totalTrackedTime": "Total tracked time:",
	"modals.taskEdit.metadata.due": "Due:",
	"modals.taskEdit.metadata.scheduled": "Scheduled:",
	"modals.taskEdit.metadata.created": "Created:",
	"modals.taskEdit.metadata.modified": "Modified:",
	"modals.taskEdit.metadata.file": "File:",
};

function createPlugin(app: App): never {
	return {
		app,
		settings: {
			calendarViewSettings: {
				timeFormat: "12",
			},
		},
		i18n: {
			translate: jest.fn((key: string) => translations[key] || key),
		},
	} as never;
}

function renderMetadata(task: TaskInfo): HTMLElement[] {
	MockObsidian.reset();
	const app = createMockApp(MockObsidian.createMockApp());
	const modal = new TaskEditModal(app, createPlugin(app), { task });
	const container = document.createElement("div");

	(modal as never as { createMetadataSection: (container: HTMLElement) => void })
		.createMetadataSection(container);

	return Array.from(container.querySelectorAll<HTMLElement>(".metadata-item"));
}

function textRows(items: HTMLElement[]): string[] {
	return items.map((item) => item.textContent?.trim() ?? "");
}

describe("Issue #2048: edit modal date metadata", () => {
	it("shows current due and scheduled dates in the task information block", () => {
		const items = renderMetadata({
			title: "Date reference task",
			status: "open",
			priority: "normal",
			path: "TaskNotes/Date reference task.md",
			archived: false,
			due: "2026-07-03",
			scheduled: "2026-07-04T14:30",
			dateCreated: "2026-07-01T09:00:00Z",
			dateModified: "2026-07-02T10:00:00Z",
		} as TaskInfo);

		expect(textRows(items)).toEqual(
			expect.arrayContaining([
				"Due: Jul 3, 2026",
				"Scheduled: Jul 4, 2026 2:30 PM",
				"File: TaskNotes/Date reference task.md",
			])
		);
	});

	it("does not add empty due or scheduled rows when the task has no dates", () => {
		const items = renderMetadata({
			title: "Undated task",
			status: "open",
			priority: "normal",
			path: "TaskNotes/Undated task.md",
			archived: false,
		} as TaskInfo);

		expect(textRows(items)).not.toEqual(
			expect.arrayContaining([expect.stringMatching(/^Due:/), expect.stringMatching(/^Scheduled:/)])
		);
	});
});
