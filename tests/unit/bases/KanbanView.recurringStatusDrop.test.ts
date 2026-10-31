import { TFile } from "obsidian";
import { KanbanView } from "../../../src/bases/KanbanView";
import type { TaskInfo } from "../../../src/types";

const mockProcessVaultFrontMatter = jest.fn();

jest.mock("../../../src/services/VaultMutationService", () => ({
	...jest.requireActual("../../../src/services/VaultMutationService"),
	processVaultFrontMatter: (...args: unknown[]) => mockProcessVaultFrontMatter(...args),
}));

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Weekly review",
		status: "todo",
		priority: "normal",
		path: "tasks/review.md",
		archived: false,
		recurrence: "DTSTART:20261019;FREQ=WEEKLY",
		scheduled: "2026-10-19",
		complete_instances: [],
		skipped_instances: [],
		...overrides,
	};
}

function makeView(storedTask: () => TaskInfo) {
	const toggleRecurringTaskComplete = jest.fn();
	const view = new KanbanView(
		{},
		document.createElement("div"),
		{
			app: { vault: { getAbstractFileByPath: (path: string) => new TFile(path) } },
			cacheManager: { getTaskInfo: jest.fn(async () => storedTask()) },
			fieldMapper: {
				toUserField: (field: string) => field,
				isRecognizedProperty: () => true,
				lookupMappingKey: (property: string) =>
					property === "status" ? "status" : null,
			},
			priorityManager: { getAllPriorities: () => [] },
			settings: {
				customStatuses: [],
				fieldMapping: { sortOrder: "sort_order" },
			},
			taskService: { applyPropertyChangeSideEffects: jest.fn() },
			statusManager: { isCompletedStatus: (status: string) => status === "done" },
			toggleRecurringTaskComplete,
		} as any
	);
	const internals = view as any;
	internals.dataAdapter = { getSortConfig: () => [] };
	internals.getGroupByPropertyId = () => "note.status";
	internals.isListTypeProperty = () => false;
	internals.getVisibleSortScopePaths = () => undefined;
	internals.getCandidateSortScopePaths = () => undefined;
	internals.schedulePostDropRender = jest.fn();
	internals.finishFastPostDrop = jest.fn();
	internals.draggedFromColumn = "todo";
	return { internals, toggleRecurringTaskComplete };
}

describe("KanbanView recurring status drops", () => {
	beforeEach(() => mockProcessVaultFrontMatter.mockClear());

	it("completes the card's occurrence instead of writing Done on the series", async () => {
		const task = createTask();
		const { internals, toggleRecurringTaskComplete } = makeView(() => task);
		internals.taskInfoCache.set(task.path, task);

		await internals.handleTaskDrop(task.path, "done", null);

		expect(toggleRecurringTaskComplete).toHaveBeenCalledTimes(1);
		expect(mockProcessVaultFrontMatter).not.toHaveBeenCalled();
	});

	it("acts once when the same card is dropped again before the view re-renders", async () => {
		let stored = createTask();
		const { internals, toggleRecurringTaskComplete } = makeView(() => stored);
		const shown = stored;
		internals.taskInfoCache.set(shown.path, shown);
		toggleRecurringTaskComplete.mockImplementation(async () => {
			stored = createTask({
				scheduled: "2026-10-26",
				complete_instances: ["2026-10-19"],
			});
		});

		await Promise.all([
			internals.handleTaskDrop(shown.path, "done", null),
			internals.handleTaskDrop(shown.path, "done", null),
		]);
		await internals.handleTaskDrop(shown.path, "done", null);

		expect(toggleRecurringTaskComplete).toHaveBeenCalledTimes(1);
		expect(mockProcessVaultFrontMatter).not.toHaveBeenCalled();
	});

	it("ignores a late drop when the occurrence was completed on another device", async () => {
		const shown = createTask();
		const { internals, toggleRecurringTaskComplete } = makeView(() =>
			createTask({ scheduled: "2026-10-26", complete_instances: ["2026-10-19"] })
		);
		internals.taskInfoCache.set(shown.path, shown);

		await internals.handleTaskDrop(shown.path, "done", null);

		expect(toggleRecurringTaskComplete).not.toHaveBeenCalled();
		expect(mockProcessVaultFrontMatter).not.toHaveBeenCalled();
	});

	it("still refreshes the board after a stale drop, so an optimistic card moves back", async () => {
		const shown = createTask();
		const { internals } = makeView(() => createTask({ complete_instances: ["2026-10-19"] }));
		internals.taskInfoCache.set(shown.path, shown);

		await internals.handleTaskDrop(shown.path, "done", null);

		expect(internals.schedulePostDropRender).toHaveBeenCalledTimes(1);
	});

	it("completes each recurring card in a batch by its own occurrence", async () => {
		const first = createTask();
		const second = createTask({ path: "tasks/upkeep.md", scheduled: "2026-10-21" });
		const tasks = new Map([first, second].map((task) => [task.path, task]));
		const { internals, toggleRecurringTaskComplete } = makeView(() => first);
		internals.plugin.cacheManager.getTaskInfo = jest.fn(async (path: string) => tasks.get(path));
		for (const task of tasks.values()) internals.taskInfoCache.set(task.path, task);

		await internals.handleTaskDrop(first.path, "done", null, undefined, {
			draggedPaths: [first.path, second.path],
		});

		expect(toggleRecurringTaskComplete).toHaveBeenCalledTimes(2);
		expect(toggleRecurringTaskComplete.mock.calls.map(([task]) => task.path)).toEqual([
			first.path,
			second.path,
		]);
	});

	it("leaves a move to another open status to the ordinary write path", async () => {
		const task = createTask();
		const { internals, toggleRecurringTaskComplete } = makeView(() => task);
		internals.taskInfoCache.set(task.path, task);

		await internals.handleTaskDrop(task.path, "doing", null);

		expect(toggleRecurringTaskComplete).not.toHaveBeenCalled();
		expect(mockProcessVaultFrontMatter).toHaveBeenCalledTimes(1);
	});

	it("leaves a drop of an ordinary task on Done to the ordinary write path", async () => {
		const task = createTask({ recurrence: undefined });
		const { internals, toggleRecurringTaskComplete } = makeView(() => task);
		internals.taskInfoCache.set(task.path, task);

		await internals.handleTaskDrop(task.path, "done", null);

		expect(toggleRecurringTaskComplete).not.toHaveBeenCalled();
		expect(mockProcessVaultFrontMatter).toHaveBeenCalledTimes(1);
	});
});
