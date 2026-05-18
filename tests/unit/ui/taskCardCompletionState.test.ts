import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import {
	updateTaskCardCompletionState,
	updateTaskCardStatusIndicatorVisuals,
} from "../../../src/ui/taskCardCompletionState";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/task.md",
		archived: false,
		...overrides,
	};
}

function createPlugin(overrides: Partial<TaskNotesPlugin> = {}): TaskNotesPlugin {
	return {
		settings: {
			showCompletedTaskStrikethrough: true,
			subtaskChevronPosition: "right",
			statuses: [
				{ id: "open", value: "open", label: "Open", color: "#888888" },
				{ id: "in-progress", value: "In Progress", label: "In Progress", color: "#123456" },
			],
		},
		statusManager: {
			getNextStatus: jest.fn(() => "In Progress"),
			getStatusConfig: jest.fn((status: string) => ({
				id: status,
				value: status,
				label: status,
				color: "#123456",
			})),
		},
		getActiveTimeSession: jest.fn(() => null),
		app: {
			metadataCache: {
				getCache: jest.fn(() => null),
			},
		},
		...overrides,
	} as unknown as TaskNotesPlugin;
}

describe("taskCardCompletionState", () => {
	it("syncs completion, status, priority, project, and title state with sanitized classes", () => {
		const plugin = createPlugin({
			settings: {
				showCompletedTaskStrikethrough: true,
				subtaskChevronPosition: "left",
			},
			getActiveTimeSession: jest.fn(() => ({ id: "active" })),
			app: {
				metadataCache: {
					getCache: jest.fn(() => ({
						sections: [{ type: "yaml" }, { type: "paragraph" }],
					})),
				},
			},
		} as unknown as Partial<TaskNotesPlugin>);
		const card = document.createElement("div");
		card.className =
			"task-card task-card--priority-old task-card--status-old task-card--project-old";
		card.dataset.status = "old";
		card.dataset.hasDetails = "false";
		const title = card.createDiv({ cls: "task-card__title" });

		updateTaskCardCompletionState(
			card,
			createTask({
				status: "In Progress",
				priority: "High Priority",
				projects: ["Project A", "Project A"],
				archived: true,
				recurrence: "FREQ=DAILY",
			}),
			plugin,
			true,
			"In Progress"
		);

		expect(card.classList.contains("task-card--completed")).toBe(true);
		expect(card.classList.contains("task-card--completed-strikethrough")).toBe(true);
		expect(card.classList.contains("task-card--archived")).toBe(true);
		expect(card.classList.contains("task-card--actively-tracked")).toBe(true);
		expect(card.classList.contains("task-card--recurring")).toBe(true);
		expect(card.classList.contains("task-card--chevron-left")).toBe(true);
		expect(card.classList.contains("task-card--has-details")).toBe(true);
		expect(card.classList.contains("task-card--priority-old")).toBe(false);
		expect(card.classList.contains("task-card--status-old")).toBe(false);
		expect(card.classList.contains("task-card--project-old")).toBe(false);
		expect(card.classList.contains("task-card--priority-high-priority")).toBe(true);
		expect(card.classList.contains("task-card--status-in-progress")).toBe(true);
		expect(card.classList.contains("task-card--has-projects")).toBe(true);
		expect(card.classList.contains("task-card--project-project-a")).toBe(true);
		expect(card.dataset.status).toBe("In Progress");
		expect(card.dataset.hasDetails).toBe("true");
		expect(title.classList.contains("completed")).toBe(true);
	});

	it("clears optional classes and checkbox state when status visuals update", () => {
		const plugin = createPlugin({
			settings: {
				showCompletedTaskStrikethrough: false,
				subtaskChevronPosition: "right",
			},
		} as unknown as Partial<TaskNotesPlugin>);
		const card = document.createElement("div");
		card.className =
			"task-card task-card--completed task-card--completed-strikethrough task-card--has-projects task-card--project-old task-card--status-done task-card--priority-high";
		const checkbox = card.createEl("input", { cls: "task-card__checkbox" });
		checkbox.type = "checkbox";
		checkbox.checked = true;
		const statusDot = card.createDiv({ cls: "task-card__status-dot" });
		card.createDiv({ cls: "task-card__title completed" });

		updateTaskCardStatusIndicatorVisuals({
			card,
			statusDot,
			plugin,
			updatedTask: createTask({ status: "open", priority: "normal", projects: [] }),
			effectiveStatus: "open",
			isCompleted: false,
		});

		expect(checkbox.checked).toBe(false);
		expect(card.classList.contains("task-card--completed")).toBe(false);
		expect(card.classList.contains("task-card--completed-strikethrough")).toBe(false);
		expect(card.classList.contains("task-card--has-projects")).toBe(false);
		expect(card.classList.contains("task-card--project-old")).toBe(false);
		expect(card.classList.contains("task-card--status-done")).toBe(false);
		expect(card.classList.contains("task-card--priority-high")).toBe(false);
		expect(card.classList.contains("task-card--status-open")).toBe(true);
		expect(card.classList.contains("task-card--priority-normal")).toBe(true);
		expect(statusDot.style.borderColor).toBe("rgb(18, 52, 86)");
		expect(card.style.getPropertyValue("--current-status-color")).toBe("#123456");
	});
});
