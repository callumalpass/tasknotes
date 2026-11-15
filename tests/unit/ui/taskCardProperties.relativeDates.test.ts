import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { renderPropertyMetadata } from "../../../src/ui/taskCardProperties";
import { renderTaskCardMetadata } from "../../../src/ui/taskCardMetadata";

function createPlugin(dateDisplayFormat: "default" | "iso" = "default"): TaskNotesPlugin {
	return {
		i18n: createI18nService(),
		settings: {
			dateDisplayFormat,
			calendarViewSettings: { timeFormat: "24" },
			hideCompletedFromOverdue: true,
			taskIdentificationMethod: "tag",
			taskTag: "task",
			hideIdentifyingTagsInCards: true,
			hideIdentifyingTagsMode: "all",
		},
		statusManager: { isCompletedStatus: jest.fn(() => false) },
		fieldMapper: {
			lookupMappingKey: jest.fn((propertyId: string) =>
				["due", "scheduled", "title"].includes(propertyId) ? propertyId : null
			),
			isPropertyForField: jest.fn(
				(propertyId: string, field: string) => propertyId === field
			),
		},
		openTagsPane: jest.fn(),
	} as unknown as TaskNotesPlugin;
}

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		path: "Tasks/example.md",
		title: "Example",
		status: "open",
		priority: "normal",
		archived: false,
		...overrides,
	} as TaskInfo;
}

function renderText(propertyId: string, task: TaskInfo, plugin = createPlugin()): string {
	const container = document.createElement("div");
	const element = renderPropertyMetadata(container, propertyId, task, plugin);
	expect(element?.querySelector(".task-card__date-value")?.textContent).not.toBe("");
	expect(element?.getAttribute("aria-label")).toContain(propertyId === "due" ? "Due:" : "Scheduled:");
	return element?.querySelector(".task-card__date-value")?.textContent ?? "";
}

describe("task card relative dates", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		// Thursday, 24 September 2026
		jest.setSystemTime(new Date(2026, 8, 24, 10, 0, 0));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("shows recently overdue due dates relative to today without a separate overdue suffix", () => {
		expect(renderText("due", createTask({ due: "2026-09-21" }))).toBe("3 days ago");
		expect(renderText("due", createTask({ due: "2026-09-23" }))).toBe("Yesterday");
	});

	it("keeps the absolute date for dates more than a week old", () => {
		expect(renderText("due", createTask({ due: "2025-12-31" }))).toBe(
			"Dec 31, 2025"
		);
	});

	it("names upcoming days within the week and keeps the time", () => {
		expect(renderText("due", createTask({ due: "2026-09-25T17:00" }))).toBe(
			"Tomorrow at 17:00"
		);
		expect(renderText("scheduled", createTask({ scheduled: "2026-09-28" }))).toBe(
			"Monday"
		);
	});

	it("drops the past suffix from scheduled dates", () => {
		expect(renderText("scheduled", createTask({ scheduled: "2026-09-01" }))).toBe(
			"Sep 1"
		);
	});

	it("keeps absolute dates when ISO display is selected", () => {
		expect(renderText("due", createTask({ due: "2026-09-25" }), createPlugin("iso"))).toBe(
			"2026-09-25"
		);
	});
});

describe("task card metadata line", () => {
	it("does not repeat the title as a file name property", () => {
		const metadataLine = document.createElement("div");
		const card = document.createElement("div");
		const plugin = createPlugin();

		const elements = renderTaskCardMetadata({
			metadataLine,
			card,
			task: createTask({ customProperties: { "file.tags": ["#task", "#errands"] } }),
			plugin,
			visibleProperties: ["file.name", "file.basename", "title", "file.tags"],
			onBlockedByToggle: jest.fn(),
		});

		expect(elements).toHaveLength(1);
		expect(metadataLine.textContent).not.toContain("Example");
		expect(metadataLine.querySelectorAll(".tag")).toHaveLength(1);
		expect(metadataLine.textContent).toContain("#errands");
	});
});
