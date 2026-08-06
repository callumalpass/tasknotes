import { EditorView } from "@codemirror/view";
import { TaskLinkWidget } from "../../../src/editor/TaskLinkWidget";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

describe("Issue #2180: inline task Live Preview mouse press", () => {
	it("prevents editor selection handling while keeping the title click active", async () => {
		const task = TaskFactory.createTask({
			path: "Tasks/Live Preview Click.md",
			title: "Live Preview Click",
		});
		const openTaskEditModal = jest.fn();
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				inlineVisibleProperties: [],
				singleClickAction: "edit",
				doubleClickAction: "none",
				showExpandableSubtasks: false,
				calendarViewSettings: {
					timeFormat: "12",
				},
			},
			statusManager: {
				isCompletedStatus: jest.fn(() => false),
				getStatusConfig: jest.fn((status: string) => ({
					value: status,
					label: status,
					color: "#666666",
				})),
				getNextStatus: jest.fn(() => "done"),
			},
			priorityManager: {
				getPriorityConfig: jest.fn((priority: string) => ({
					value: priority,
					label: priority,
					color: "#ff0000",
				})),
			},
			fieldMapper: {
				toUserField: jest.fn((field: string) => field),
				toInternalField: jest.fn((field: string) => field),
			},
			projectSubtasksService: {
				isTaskUsedAsProjectSync: jest.fn(() => false),
			},
			openTaskEditModal,
			i18n: {
				translate: jest.fn((key: string, vars?: Record<string, unknown>) => {
					if (key === "ui.taskCard.priorityAriaLabel") {
						return `Priority: ${String(vars?.label ?? "")}`;
					}
					if (key === "ui.taskCard.taskOptions") {
						return "Task options";
					}
					return key;
				}),
			},
		}) as unknown as TaskNotesPlugin;
		const widget = new TaskLinkWidget(
			task as TaskInfo,
			plugin,
			"[[Live Preview Click]]"
		);
		const wrapper = widget.toDOM({ dispatch: jest.fn() } as unknown as EditorView);
		const editorParent = document.createElement("div");
		const editorMouseDown = jest.fn();
		editorParent.addEventListener("mousedown", editorMouseDown);
		editorParent.appendChild(wrapper);

		const title = wrapper.querySelector(".task-card__title-text") as HTMLElement;
		const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
		title.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		expect(editorMouseDown).not.toHaveBeenCalled();

		title.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		await Promise.resolve();

		expect(openTaskEditModal).toHaveBeenCalledWith(
			expect.objectContaining({ path: task.path })
		);
	});
});
