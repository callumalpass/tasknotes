import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import {
	applyTaskCardPriorityColor,
	applyTaskCardStatusColors,
	createPriorityIndicator,
	createStatusIndicator,
	updatePriorityIndicator,
	updateStatusIndicator,
} from "../../../src/ui/taskCardPrimaryIndicators";

jest.mock("obsidian");

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

function createPlugin(): TaskNotesPlugin {
	return {
		fieldMapper: {
			isPropertyForField: jest.fn(
				(propertyId: string, field: string) => propertyId === field
			),
		},
		statusManager: {
			getStatusConfig: jest.fn((status: string) => {
				if (status === "open") {
					return { value: "open", label: "Open", color: "#111111" };
				}
				if (status === "done") {
					return { value: "done", label: "Done", color: "#222222", icon: "check" };
				}
				return null;
			}),
			getNextStatus: jest.fn((status: string) => (status === "open" ? "done" : "open")),
		},
		priorityManager: {
			getPriorityConfig: jest.fn((priority: string) => {
				if (priority === "high") {
					return { value: "high", label: "High", color: "#ff0000", icon: "flame" };
				}
				if (priority === "normal") {
					return { value: "normal", label: "Normal", color: "#888888" };
				}
				return null;
			}),
		},
		i18n: {
			translate: jest.fn((key: string, vars?: Record<string, string>) => {
				if (key === "ui.taskCard.priorityAriaLabel") {
					return `Priority: ${vars?.label ?? ""}`;
				}
				return key;
			}),
		},
	} as unknown as TaskNotesPlugin;
}

function createCard() {
	const card = document.createElement("div");
	card.className = "task-card";
	const mainRow = card.createDiv({ cls: "task-card__main-row" });
	document.body.appendChild(card);
	return { card, mainRow };
}

describe("taskCardPrimaryIndicators", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("creates an interactive status indicator and applies current/next status colors", () => {
		const plugin = createPlugin();
		const { card, mainRow } = createCard();
		const onClick = jest.fn();

		const statusDot = createStatusIndicator({
			mainRow,
			card,
			task: createTask(),
			plugin,
			effectiveStatus: "open",
			onClick,
		});

		expect(statusDot).not.toBeNull();
		expect(statusDot?.classList.contains("task-card__status-dot")).toBe(true);
		expect(statusDot?.style.borderColor).toBe("rgb(17, 17, 17)");
		expect(statusDot?.dataset.tnNoDrag).toBe("true");
		expect(card.style.getPropertyValue("--current-status-color")).toBe("#111111");
		expect(card.style.getPropertyValue("--next-status-color")).toBe("#222222");

		statusDot?.click();
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("updates, removes, and recreates status indicators", () => {
		const plugin = createPlugin();
		const { card, mainRow } = createCard();
		const checkbox = mainRow.createEl("input", { cls: "task-card__checkbox" });
		const onClick = jest.fn();

		expect(
			updateStatusIndicator({
				mainRow,
				card,
				task: createTask(),
				plugin,
				effectiveStatus: "done",
				visibleProperties: ["title"],
				onClick,
			})
		).toBeNull();

		const created = updateStatusIndicator({
			mainRow,
			card,
			task: createTask(),
			plugin,
			effectiveStatus: "done",
			visibleProperties: ["status"],
			onClick,
		});

		expect(created).not.toBeNull();
		expect(created?.previousElementSibling).toBe(checkbox);
		expect(created?.classList.contains("task-card__status-dot--icon")).toBe(true);

		updateStatusIndicator({
			mainRow,
			card,
			task: createTask(),
			plugin,
			effectiveStatus: "open",
			hideStatusIndicator: true,
			onClick,
		});

		expect(card.querySelector(".task-card__status-dot")).toBeNull();
	});

	it("creates and updates priority indicators with icon and aria state", () => {
		const plugin = createPlugin();
		const { card, mainRow } = createCard();
		mainRow.createSpan({ cls: "task-card__status-dot" });
		const onClick = jest.fn();

		const created = createPriorityIndicator({
			mainRow,
			task: createTask({ priority: "high" }),
			plugin,
			onClick,
		});

		expect(created).not.toBeNull();
		expect(created?.classList.contains("task-card__priority-dot--icon")).toBe(true);
		expect(created?.getAttribute("aria-label")).toBe("Priority: High");
		expect(created?.dataset.tnNoDrag).toBe("true");
		created?.click();
		expect(onClick).toHaveBeenCalledTimes(1);

		const updated = updatePriorityIndicator({
			mainRow,
			task: createTask({ priority: "normal" }),
			plugin,
			onClick,
		});

		expect(updated).not.toBe(created);
		expect(updated?.previousElementSibling?.classList.contains("task-card__status-dot")).toBe(
			true
		);
		expect(updated?.classList.contains("task-card__priority-dot--icon")).toBe(false);
		expect(card.querySelector(".task-card__priority-dot")).toBe(updated);
	});

	it("stores the custom priority color in both legacy and current CSS variables", () => {
		const plugin = createPlugin();
		const { card } = createCard();

		applyTaskCardPriorityColor(card, createTask({ priority: "normal" }), plugin);

		expect(card.style.getPropertyValue("--priority-color")).toBe("#888888");
		expect(card.style.getPropertyValue("--current-priority-color")).toBe("#888888");
	});

	it("removes priority indicators and stale priority colors when no priority config exists", () => {
		const plugin = createPlugin();
		const { card, mainRow } = createCard();
		mainRow.createSpan({ cls: "task-card__priority-dot" });
		card.style.setProperty("--priority-color", "#ff0000");
		card.style.setProperty("--current-priority-color", "#ff0000");

		expect(
			applyTaskCardPriorityColor(card, createTask({ priority: "none" }), plugin)
		).toBeNull();
		expect(card.style.getPropertyValue("--priority-color")).toBe("");
		expect(card.style.getPropertyValue("--current-priority-color")).toBe("");
		expect(
			updatePriorityIndicator({
				mainRow,
				task: createTask({ priority: "none" }),
				plugin,
				onClick: jest.fn(),
			})
		).toBeNull();
		expect(card.querySelector(".task-card__priority-dot")).toBeNull();
	});

	it("removes stale status colors when status configs are missing", () => {
		const plugin = createPlugin();
		const { card } = createCard();
		card.style.setProperty("--current-status-color", "#111111");
		card.style.setProperty("--next-status-color", "#222222");

		applyTaskCardStatusColors(card, "unknown", plugin);

		expect(card.style.getPropertyValue("--current-status-color")).toBe("");
		expect(card.style.getPropertyValue("--next-status-color")).toBe("#111111");
	});
});
