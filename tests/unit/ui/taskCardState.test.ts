import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import {
	buildTaskCardRenderState,
	getDefaultTaskCardTargetDate,
	taskHasDetails,
} from "../../../src/ui/taskCardState";

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
		},
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
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

describe("taskCardState", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("uses scheduled date as the default recurring target date", () => {
		const targetDate = getDefaultTaskCardTargetDate(
			createTask({
				recurrence: "FREQ=DAILY",
				recurrence_anchor: "scheduled",
				scheduled: "2026-05-19",
			})
		);

		expect(targetDate.toISOString()).toBe("2026-05-19T00:00:00.000Z");
	});

	it("builds recurring completion and layout classes from one state path", () => {
		const plugin = createPlugin();
		const state = buildTaskCardRenderState(
			createTask({
				recurrence: "FREQ=DAILY",
				recurrence_anchor: "scheduled",
				scheduled: "2026-05-19",
				complete_instances: ["2026-05-19"],
			}),
			plugin,
			{ layout: "compact" }
		);

		expect(state.targetDate.toISOString()).toBe("2026-05-19T00:00:00.000Z");
		expect(state.isCompleted).toBe(true);
		expect(state.cardClasses).toEqual(
			expect.arrayContaining([
				"task-card--layout-compact",
				"task-card--completed",
				"task-card--completed-strikethrough",
				"task-card--recurring",
			])
		);
	});

	it("builds active, details, project, status, priority, and chevron classes", () => {
		const plugin = createPlugin({
			settings: {
				showCompletedTaskStrikethrough: false,
				subtaskChevronPosition: "left",
			},
			getActiveTimeSession: jest.fn(() => ({ id: "session" })),
			app: {
				metadataCache: {
					getCache: jest.fn(() => ({
						sections: [{ type: "yaml" }, { type: "paragraph" }],
					})),
				},
			},
		} as unknown as Partial<TaskNotesPlugin>);

		const state = buildTaskCardRenderState(
			createTask({
				status: "in-progress",
				priority: "High Priority",
				projects: ["Project A", "Project A"],
				archived: true,
			}),
			plugin
		);

		expect(state.hasDetails).toBe(true);
		expect(state.cardClasses).toEqual(
			expect.arrayContaining([
				"task-card--archived",
				"task-card--actively-tracked",
				"task-card--has-details",
				"task-card--priority-high-priority",
				"task-card--status-in-progress",
				"task-card--chevron-left",
				"task-card--has-projects",
				"task-card--project-project-a",
			])
		);
		expect(state.cardClasses.filter((className) => className === "task-card--project-project-a")).toHaveLength(
			1
		);
	});

	it("treats non-empty task details as details without metadata-cache lookup", () => {
		const plugin = createPlugin();

		expect(taskHasDetails(createTask({ details: "Body content" }), plugin)).toBe(true);
		expect(plugin.app.metadataCache.getCache).not.toHaveBeenCalled();
	});
});
