import { EditorView } from "@codemirror/view";
import { extractTaskPathFromExternalDrop } from "../../../src/bases/CalendarView";
import { TaskLinkWidget } from "../../../src/editor/TaskLinkWidget";
import TaskNotesPlugin from "../../../src/main";
import { TaskInfo } from "../../../src/types";
import { createTaskCard } from "../../../src/ui/TaskCard";

jest.mock("../../../src/ui/TaskCard", () => ({
	createTaskCard: jest.fn(() => {
		const card = document.createElement("span");
		card.className = "task-card";
		return card;
	}),
}));

function createDataTransfer(values: Record<string, string>): DataTransfer {
	return {
		getData: jest.fn((type: string) => values[type] ?? ""),
	} as unknown as DataTransfer;
}

describe("Issue #1811: calendar external task drops", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		Object.defineProperty(globalThis, "activeDocument", {
			value: document,
			configurable: true,
		});
	});

	it("extracts task paths from FullCalendar external drop data", () => {
		const dataTransfer = createDataTransfer({
			"application/x-task-path": "Tasks/Drag me.md",
			"text/plain": "fallback.md",
		});
		const jsEvent = { dataTransfer } as unknown as DragEvent;

		expect(extractTaskPathFromExternalDrop({ jsEvent })).toBe("Tasks/Drag me.md");
	});

	it("extracts task paths from dragged task card elements", () => {
		const wrapper = document.createElement("span");
		wrapper.dataset.taskPath = "Tasks/Inline task.md";
		const child = document.createElement("span");
		wrapper.appendChild(child);

		expect(extractTaskPathFromExternalDrop({ draggedEl: child })).toBe(
			"Tasks/Inline task.md"
		);
	});

	it("registers inline task widgets with the calendar drag manager", () => {
		const task = {
			path: "Tasks/Inline task.md",
			title: "Inline task",
			status: "todo",
		} as TaskInfo;
		const dragDropManager = {
			makeTaskCardDraggable: jest.fn(),
		};
		const plugin = {
			settings: {
				inlineVisibleProperties: [],
			},
			dragDropManager,
		} as unknown as TaskNotesPlugin;
		const widget = new TaskLinkWidget(task, plugin, "[[Inline task]]");

		const element = widget.toDOM({ dispatch: jest.fn() } as unknown as EditorView);

		expect(createTaskCard).toHaveBeenCalledWith(task, plugin, [], expect.any(Object));
		expect(dragDropManager.makeTaskCardDraggable).toHaveBeenCalledWith(
			element,
			"Tasks/Inline task.md"
		);
		expect(widget.ignoreEvent(new Event("dragstart"))).toBe(true);
	});
});
