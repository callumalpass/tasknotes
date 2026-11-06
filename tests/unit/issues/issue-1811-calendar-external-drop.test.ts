import { englishText } from "../../helpers/real-i18n";
import { EditorView } from "@codemirror/view";
import {
	acceptsExternalTaskDrop,
	getExternalTaskDropPath,
} from "../../../src/bases/calendarExternalTaskDrop";
import { TaskLinkWidget } from "../../../src/editor/TaskLinkWidget";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { DragDropManager, TASK_PATH_DRAG_TYPE } from "../../../src/utils/DragDropManager";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

function dataTransfer(values: Record<string, string>): DataTransfer {
	const data = { ...values };
	return {
		get types() {
			return Object.keys(data);
		},
		getData: (type: string) => data[type] ?? "",
		setData: (type: string, value: string) => {
			data[type] = value;
		},
		effectAllowed: "none",
	} as unknown as DataTransfer;
}

function createPlugin(): TaskNotesPlugin {
	const plugin = PluginFactory.createMockPlugin({
		settings: {
			inlineVisibleProperties: [],
			singleClickAction: "edit",
			doubleClickAction: "none",
			showExpandableSubtasks: false,
			calendarViewSettings: { timeFormat: "12" },
		},
		statusManager: {
			isCompletedStatus: jest.fn(() => false),
			getStatusConfig: jest.fn((status: string) => ({ value: status, label: status, color: "#666666" })),
			getNextStatus: jest.fn(() => "done"),
		},
		priorityManager: {
			getPriorityConfig: jest.fn((priority: string) => ({ value: priority, label: priority, color: "#ff0000" })),
		},
		fieldMapper: {
			toUserField: jest.fn((field: string) => field),
			toInternalField: jest.fn((field: string) => field),
		},
		projectSubtasksService: { isTaskUsedAsProjectSync: jest.fn(() => false) },
		i18n: { translate: jest.fn(englishText) },
	}) as unknown as TaskNotesPlugin;
	plugin.dragDropManager = new DragDropManager(plugin);
	return plugin;
}

describe("Issue #1811: dragging tasks onto the Calendar view", () => {
	it("accepts only drags that carry a task path", () => {
		const taskDrag = dataTransfer({ [TASK_PATH_DRAG_TYPE]: " Tasks/Drag me.md ", "text/plain": "x" });
		const textDrag = dataTransfer({ "text/plain": "Tasks/Drag me.md" });

		expect(acceptsExternalTaskDrop(taskDrag)).toBe(true);
		expect(getExternalTaskDropPath(taskDrag)).toBe("Tasks/Drag me.md");
		expect(acceptsExternalTaskDrop(textDrag)).toBe(false);
		expect(getExternalTaskDropPath(textDrag)).toBeUndefined();
		expect(getExternalTaskDropPath(null)).toBeUndefined();
	});

	it("lets inline task widgets be dragged without handing the press to the editor", () => {
		const task = TaskFactory.createTask({ path: "Tasks/Inline task.md", title: "Inline task" });
		const widget = new TaskLinkWidget(task as TaskInfo, createPlugin(), "[[Inline task]]");
		const wrapper = widget.toDOM({ dispatch: jest.fn() } as unknown as EditorView);
		const editorParent = document.createElement("div");
		const editorMouseDown = jest.fn();
		editorParent.addEventListener("mousedown", editorMouseDown);
		editorParent.appendChild(wrapper);

		const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
		wrapper.querySelector(".task-card__title-text")?.dispatchEvent(press);
		// Cancelling the press would cancel the drag before it starts.
		expect(press.defaultPrevented).toBe(false);
		expect(editorMouseDown).not.toHaveBeenCalled();

		const transfer = dataTransfer({});
		const dragStart = new Event("dragstart", { bubbles: true }) as DragEvent;
		Object.defineProperty(dragStart, "dataTransfer", { value: transfer });
		wrapper.dispatchEvent(dragStart);

		expect(wrapper.draggable).toBe(true);
		expect(transfer.getData(TASK_PATH_DRAG_TYPE)).toBe("Tasks/Inline task.md");
		expect(widget.ignoreEvent(dragStart)).toBe(true);
	});
});
