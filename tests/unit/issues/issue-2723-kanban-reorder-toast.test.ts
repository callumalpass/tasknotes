import { TFile } from "obsidian";
import { serialize, deserialize } from "node:v8";
import { KanbanView } from "../../../src/bases/KanbanView";
import type { TaskInfo } from "../../../src/types";
import { taskReorderMessage } from "../../../src/ui/taskPropertyPickers";

if (!globalThis.structuredClone) {
	globalThis.structuredClone = (value) => deserialize(serialize(value));
}

const mockProcessVaultFrontMatter = jest.fn();
const mockShowToast = jest.fn();
const mockPrepareSortOrderUpdate = jest.fn();

jest.mock("../../../src/services/VaultMutationService", () => ({
	...jest.requireActual("../../../src/services/VaultMutationService"),
	processVaultFrontMatter: (...args: unknown[]) => mockProcessVaultFrontMatter(...args),
}));

jest.mock("../../../src/ui/kit/toast", () => ({
	...jest.requireActual("../../../src/ui/kit/toast"),
	showToast: (...args: unknown[]) => mockShowToast(...args),
}));

jest.mock("../../../src/bases/sortOrderUtils", () => ({
	...jest.requireActual("../../../src/bases/sortOrderUtils"),
	prepareSortOrderUpdate: (...args: unknown[]) => mockPrepareSortOrderUpdate(...args),
}));

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Draft release notes",
		status: "open",
		priority: "high",
		path: "tasks/draft.md",
		archived: false,
		sortOrder: "tn0000000002",
		...overrides,
	};
}

function makeHarness(tasks: TaskInfo[], options: { swimLanePropertyId?: string | null } = {}) {
	const files = new Map(tasks.map((task) => [task.path, new TFile(task.path)]));
	const frontmatters = new Map<string, Record<string, unknown>>(
		tasks.map((task) => [
			task.path,
			{
				status: task.status,
				priority: task.priority,
				sort_order: task.sortOrder,
			},
		])
	);
	const statusConfigs = [
		{ id: "open", value: "open", label: "Open", color: "#888", isCompleted: false, order: 0 },
		{ id: "done", value: "done", label: "Done", color: "#0a0", isCompleted: true, order: 1 },
	];
	const priorityConfigs = [
		{ id: "high", value: "high", label: "High", color: "#f00", weight: 2 },
		{ id: "low", value: "low", label: "Low", color: "#00f", weight: 1 },
	];

	mockProcessVaultFrontMatter.mockImplementation(
		async (_app: unknown, file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm = frontmatters.get(file.path) ?? {};
			updater(fm);
			frontmatters.set(file.path, fm);
		}
	);

	const taskMap = new Map(tasks.map((task) => [task.path, task]));
	const view = new KanbanView(
		{},
		document.createElement("div"),
		{
			app: {
				vault: {
					getAbstractFileByPath: (path: string) => files.get(path) ?? null,
				},
			},
			cacheManager: {
				getTaskInfo: jest.fn(async (path: string) => taskMap.get(path) ?? null),
			},
			fieldMapper: {
				toUserField: (field: string) => (field === "dateModified" ? "dateModified" : field),
				isRecognizedProperty: () => true,
				lookupMappingKey: (property: string) =>
					property === "status" || property === "priority" ? property : null,
				mapFromFrontmatter: (fm: Record<string, unknown>, path: string) => ({
					...(taskMap.get(path) ?? createTask({ path })),
					status: String(fm.status ?? ""),
					priority: String(fm.priority ?? ""),
					sortOrder: fm.sort_order as string | undefined,
					dateModified: fm.dateModified as string | undefined,
				}),
			},
			priorityManager: {
				getAllPriorities: () => priorityConfigs,
				getPriorityConfig: (value: string) => priorityConfigs.find((p) => p.value === value),
			},
			statusManager: {
				isCompletedStatus: (status: string) => status === "done",
				getStatusConfig: (value: string) => statusConfigs.find((s) => s.value === value),
			},
			settings: {
				customStatuses: statusConfigs,
				customPriorities: priorityConfigs,
				storeTitleInFilename: false,
				fieldMapping: { sortOrder: "sort_order" },
			},
			taskService: {
				applyPropertyChangeSideEffects: jest.fn(),
				updateCompletedDateInFrontmatter: jest.fn(),
			},
		} as any
	);

	const internals = view as any;
	internals.dataAdapter = {
		getSortConfig: () => [{ property: "sort_order", direction: "ASC" }],
	};
	internals.getGroupByPropertyId = () => "note.status";
	internals.swimLanePropertyId = options.swimLanePropertyId ?? null;
	internals.isListTypeProperty = () => false;
	internals.getVisibleSortScopePaths = () => tasks.map((task) => task.path);
	internals.getCandidateSortScopePaths = () => tasks.map((task) => task.path);
	internals.schedulePostDropRender = jest.fn();
	internals.finishFastPostDrop = jest.fn();
	internals.applyOptimisticSortOrderResult = jest.fn().mockReturnValue(true);
	internals.applySuccessfulKanbanDropLocally = jest.fn().mockReturnValue(true);
	for (const task of tasks) {
		internals.taskInfoCache.set(task.path, task);
	}

	return { internals, frontmatters };
}

describe("issue #2723 Kanban same-column reorder toast", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockPrepareSortOrderUpdate.mockResolvedValue({
			sortOrder: "tn0000000000",
			additionalWrites: [],
			reason: "midpoint",
		});
	});

	it("formats localized reorder feedback message", () => {
		expect(taskReorderMessage("Open")).toBe("Reordered in Open");
	});

	it("shows 'Reordered in <Status>' with undo for same-column manual reorder", async () => {
		const taskA = createTask({ path: "tasks/a.md", status: "open", sortOrder: "tn0000000001" });
		const taskB = createTask({ path: "tasks/b.md", status: "open", sortOrder: "tn0000000002" });
		const { internals } = makeHarness([taskA, taskB]);
		internals.draggedFromColumn = "open";

		await internals.handleTaskDrop(taskB.path, "open", null, {
			taskPath: taskA.path,
			above: true,
		});

		expect(mockShowToast).toHaveBeenCalledTimes(1);
		expect(mockShowToast).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Reordered in Open",
				action: expect.objectContaining({ label: "Undo", run: expect.any(Function) }),
			})
		);
	});

	it("shows 'Reordered in <Status> · <Swimlane>' when reordering within the same swimlane cell", async () => {
		const taskA = createTask({ path: "tasks/a.md", status: "open", priority: "high" });
		const taskB = createTask({ path: "tasks/b.md", status: "open", priority: "high" });
		const { internals } = makeHarness([taskA, taskB], {
			swimLanePropertyId: "note.priority",
		});
		internals.draggedFromColumn = "open";
		internals.draggedFromSwimlane = "high";

		await internals.handleTaskDrop(taskB.path, "open", "high", {
			taskPath: taskA.path,
			above: true,
		});

		expect(mockShowToast).toHaveBeenCalledTimes(1);
		expect(mockShowToast).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Reordered in Open · High",
				action: expect.objectContaining({ label: "Undo" }),
			})
		);
	});

	it("keeps 'Moved 1 task to <Status>' when moving across columns", async () => {
		const taskA = createTask({ path: "tasks/a.md", status: "open" });
		const taskB = createTask({ path: "tasks/b.md", status: "done" });
		const { internals } = makeHarness([taskA, taskB]);
		internals.draggedFromColumn = "open";

		await internals.handleTaskDrop(taskA.path, "done", null, {
			taskPath: taskB.path,
			above: true,
		});

		expect(mockShowToast).toHaveBeenCalledTimes(1);
		expect(mockShowToast).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Moved 1 task to Done",
			})
		);
	});

	it("keeps 'Moved 1 task to <Status> · <Swimlane>' when changing swimlanes in the same column", async () => {
		const taskA = createTask({ path: "tasks/a.md", status: "open", priority: "high" });
		const taskB = createTask({ path: "tasks/b.md", status: "open", priority: "low" });
		const { internals } = makeHarness([taskA, taskB], {
			swimLanePropertyId: "note.priority",
		});
		internals.draggedFromColumn = "open";
		internals.draggedFromSwimlane = "high";

		await internals.handleTaskDrop(taskA.path, "open", "low", {
			taskPath: taskB.path,
			above: true,
		});

		expect(mockShowToast).toHaveBeenCalledTimes(1);
		expect(mockShowToast).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Moved 1 task to Open · Low",
			})
		);
	});

	it("keeps 'Moved' message for a batch drop when at least one task changes columns", async () => {
		const taskOpen = createTask({ path: "tasks/open.md", status: "open" });
		const taskDone = createTask({ path: "tasks/done.md", status: "done" });
		const taskTarget = createTask({ path: "tasks/target.md", status: "open" });
		const { internals } = makeHarness([taskOpen, taskDone, taskTarget]);
		internals.draggedSourceColumns.set(taskOpen.path, "open");
		internals.draggedSourceColumns.set(taskDone.path, "done");

		await internals.handleTaskDrop(
			taskDone.path,
			"open",
			null,
			{ taskPath: taskTarget.path, above: true },
			{ draggedPaths: [taskOpen.path, taskDone.path] }
		);

		expect(mockShowToast).toHaveBeenCalledTimes(1);
		expect(mockShowToast).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Moved 2 tasks to Open",
			})
		);
	});
});
