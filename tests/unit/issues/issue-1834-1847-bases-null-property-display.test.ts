/**
 * Regression coverage for #1834 and #1847.
 *
 * Empty Bases formula/custom property values should not leave "null" metadata
 * pills on TaskNotes task cards.
 */

import { App } from "obsidian";
import { createTaskCard } from "../../../src/ui/TaskCard";
import { TaskInfo } from "../../../src/types";

jest.mock("../../../src/utils/helpers", () => ({
	calculateTotalTimeSpent: jest.fn((entries) => (entries?.length ? entries.length * 30 : 0)),
	filterEmptyProjects: jest.fn((projects) => projects?.filter((p: string) => p?.trim()) || []),
	getEffectiveTaskStatus: jest.fn((task) => task.status || "open"),
	getRecurrenceDisplayText: jest.fn(() => "Daily"),
	sanitizeForCssClass: jest.fn((value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-")),
	shouldUseRecurringTaskUI: jest.fn(() => false),
}));

jest.mock("../../../src/utils/dateUtils", () => ({
	formatDateForStorage: jest.fn(() => "2026-04-30"),
	formatDateTimeForDisplay: jest.fn((value) => String(value)),
	getDatePart: jest.fn((value) => String(value).split("T")[0]),
	getTimePart: jest.fn(() => null),
	isOverdueTimeAware: jest.fn(() => false),
	isTodayTimeAware: jest.fn(() => false),
}));

jest.mock("../../../src/components/TaskContextMenu", () => ({
	TaskContextMenu: jest.fn().mockImplementation(() => ({ show: jest.fn() })),
}));

function createMockPlugin(): any {
	const app = new App();
	app.renderContext = {} as any;
	app.metadataCache.getCache = jest.fn(() => ({ frontmatter: {} }));
	app.metadataCache.getFirstLinkpathDest = jest.fn();
	app.workspace.openLinkText = jest.fn();
	app.workspace.trigger = jest.fn();
	app.vault.getAbstractFileByPath = jest.fn();

	return {
		app,
		fieldMapper: {
			getMapping: jest.fn(() => ({
				status: "status",
				priority: "priority",
			})),
			isPropertyForField: jest.fn(() => false),
			lookupMappingKey: jest.fn(() => null),
			toUserField: jest.fn((field) => field),
		},
		getActiveTimeSession: jest.fn(() => null),
		i18n: {
			translate: jest.fn((key) => key),
		},
		priorityManager: {
			getPriorityConfig: jest.fn(() => ({ color: "#888888" })),
		},
		projectSubtasksService: {
			isTaskUsedAsProjectSync: jest.fn(() => false),
		},
		settings: {
			calendarViewSettings: {
				timeFormat: "24",
			},
			showExpandableSubtasks: false,
			subtaskChevronPosition: "right",
		},
		statusManager: {
			getAllStatuses: jest.fn(() => [{ value: "open", label: "Open" }]),
			getCompletedStatuses: jest.fn(() => ["done"]),
			getNextStatus: jest.fn(() => "done"),
			getStatusConfig: jest.fn(() => ({ color: "#888888" })),
			isCompletedStatus: jest.fn(() => false),
		},
		toggleTaskStatus: jest.fn(),
	};
}

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		archived: false,
		path: "Tasks/test.md",
		priority: "normal",
		status: "open",
		title: "Test task",
		...overrides,
	};
}

function metadataText(card: HTMLElement): string {
	return card.querySelector(".task-card__metadata")?.textContent || "";
}

describe("Issue #1834/#1847: empty Bases properties on Task cards", () => {
	it("does not render null-like string placeholders for visible custom/formula properties", () => {
		const plugin = createMockPlugin();
		const task = createTask({
			customProperties: {
				"formula.daysUntil": "null",
				link: "undefined",
				empty: "",
				whitespace: "   ",
			},
		});

		const card = createTaskCard(task, plugin, [
			"formula.daysUntil",
			"link",
			"empty",
			"whitespace",
		]);

		expect(metadataText(card)).toBe("");
		expect((card.querySelector(".task-card__metadata") as HTMLElement).style.display).toBe(
			"none"
		);
	});

	it("does not render Bases values whose display text is empty or null", () => {
		const plugin = createMockPlugin();
		const nullValue = {
			isTruthy: () => false,
			renderTo: jest.fn((el: HTMLElement) => {
				el.textContent = "null";
			}),
			toString: () => "null",
		};
		const emptyValue = {
			isTruthy: () => false,
			renderTo: jest.fn(),
			toString: () => "",
		};
		const task = createTask({
			customProperties: {
				"formula.daysUntil": nullValue,
				"formula.empty": emptyValue,
			},
		});

		const card = createTaskCard(task, plugin, ["formula.daysUntil", "formula.empty"]);

		expect(metadataText(card)).toBe("");
		expect(nullValue.renderTo).not.toHaveBeenCalled();
		expect(emptyValue.renderTo).not.toHaveBeenCalled();
	});

	it("filters null-like array items while preserving meaningful falsy values", () => {
		const plugin = createMockPlugin();
		const task = createTask({
			customProperties: {
				count: 0,
				flag: false,
				links: ["null", null, "", "Task A"],
			},
		});

		const card = createTaskCard(task, plugin, ["count", "flag", "links"]);
		const text = metadataText(card);

		expect(text).toContain("Count: 0");
		expect(text).toContain("Flag:");
		expect(text).toContain("Links: Task A");
		expect(text).not.toContain("null");
	});
});
