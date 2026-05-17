/**
 * Issue #1339: task cards can render project subtasks expanded by default.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1339
 */

import { createTaskCard } from "../../../src/ui/TaskCard";
import { ExpandedProjectsService } from "../../../src/services/ExpandedProjectsService";
import type TaskNotesPlugin from "../../../src/main";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

function waitForAsyncRender(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 20));
}

describe("Issue #1339: expand subtasks by default", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("treats projects as expanded by default while preserving manual collapse state", () => {
		const service = new ExpandedProjectsService({} as TaskNotesPlugin);
		const taskPath = "Tasks/parent.md";

		expect(service.isExpanded(taskPath, true)).toBe(true);

		expect(service.toggle(taskPath, true)).toBe(false);
		expect(service.isExpanded(taskPath, true)).toBe(false);

		expect(service.toggle(taskPath, true)).toBe(true);
		expect(service.isExpanded(taskPath, true)).toBe(true);
	});

	it("renders project subtasks immediately when the setting is enabled", async () => {
		const parent = TaskFactory.createTask({
			path: "Tasks/parent.md",
			title: "Parent project",
		});
		const child = TaskFactory.createTask({
			path: "Tasks/child.md",
			title: "Visible child",
		});

		const plugin = PluginFactory.createMockPlugin({
			priorityManager: {
				getPriorityConfig: jest.fn().mockReturnValue({ color: "#666666" }),
				getPriorityWeight: jest.fn().mockReturnValue(0),
			},
			statusManager: {
				isCompletedStatus: jest.fn().mockReturnValue(false),
				getCompletedStatuses: jest.fn(() => ["done"]),
				getStatusConfig: jest.fn().mockReturnValue({ color: "#666666" }),
				getNextStatus: jest.fn().mockReturnValue("done"),
			},
		}) as TaskNotesPlugin;
		plugin.settings = {
			...plugin.settings,
			showExpandableSubtasks: true,
			expandSubtasksByDefault: true,
			subtaskChevronPosition: "right",
		};
		plugin.expandedProjectsService = new ExpandedProjectsService(plugin);
		plugin.projectSubtasksService = {
			isTaskUsedAsProjectSync: jest.fn((path: string) => path === parent.path),
			isTaskUsedAsProject: jest.fn(async (path: string) => path === parent.path),
			getTasksLinkedToProject: jest.fn(async () => [child]),
			sortTasks: jest.fn((tasks) => tasks),
		} as never;

		const card = createTaskCard(parent, plugin);
		document.body.appendChild(card);
		await waitForAsyncRender();

		const chevron = card.querySelector<HTMLElement>(".task-card__chevron");
		const renderedSubtasks = Array.from(
			card.querySelectorAll<HTMLElement>(".task-card__subtasks > .task-card")
		);

		expect(chevron).not.toBeNull();
		expect(chevron?.classList.contains("task-card__chevron--expanded")).toBe(true);
		expect(renderedSubtasks.map((subtaskCard) => subtaskCard.dataset.taskPath)).toEqual([
			child.path,
		]);

		chevron?.click();
		await waitForAsyncRender();

		expect(chevron?.classList.contains("task-card__chevron--expanded")).toBe(false);
		expect(card.querySelector(".task-card__subtasks")).toBeNull();
	});
});
