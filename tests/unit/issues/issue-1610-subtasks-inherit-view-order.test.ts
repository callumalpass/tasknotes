/**
 * Issue #1610: expanded subtasks in TaskNotes Bases views should follow the
 * view's sorted task order instead of the fixed project-subtask fallback sort.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1610
 */

import { toggleSubtasks, createTaskCard } from "../../../src/ui/TaskCard";
import type TaskNotesPlugin from "../../../src/main";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

describe("Issue #1610: expanded subtasks inherit view order", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("renders ranked subtasks using the current Bases view order", async () => {
		const parentTask = TaskFactory.createTask({
			path: "Tasks/parent.md",
			title: "Parent",
			status: "open",
			priority: "normal",
		});
		const first = TaskFactory.createTask({
			path: "Tasks/first.md",
			title: "First by view",
			status: "open",
			priority: "normal",
		});
		const second = TaskFactory.createTask({
			path: "Tasks/second.md",
			title: "Second by view",
			status: "open",
			priority: "normal",
		});
		const third = TaskFactory.createTask({
			path: "Tasks/third.md",
			title: "Third by view",
			status: "open",
			priority: "normal",
		});

		const mockPlugin = PluginFactory.createMockPlugin({
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
			projectSubtasksService: {
				getTasksLinkedToProject: jest.fn().mockResolvedValue([third, second, first]),
				sortTasks: jest.fn((tasks) =>
					[...tasks].sort((a, b) => a.title.localeCompare(b.title))
				),
				isTaskUsedAsProjectSync: jest.fn().mockReturnValue(false),
			},
		}) as TaskNotesPlugin;

		const card = createTaskCard(parentTask, mockPlugin, undefined, {
			expandedRelationshipTaskOrder: new Map([
				[first.path, 0],
				[second.path, 1],
				[third.path, 2],
			]),
		});
		document.body.appendChild(card);

		await toggleSubtasks(card, parentTask, mockPlugin, true);

		const renderedPaths = Array.from(
			card.querySelectorAll<HTMLElement>(".task-card__subtasks > .task-card")
		).map((subtaskCard) => subtaskCard.dataset.taskPath);

		expect(renderedPaths).toEqual([first.path, second.path, third.path]);
	});
});
