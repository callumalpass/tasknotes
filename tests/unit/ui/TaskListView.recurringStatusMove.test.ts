import { TFile } from "obsidian";
import { App, MockObsidian } from "../../helpers/obsidian-runtime";
import { TaskListView } from "../../../src/bases/TaskListView";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { TaskFactory } from "../../helpers/mock-factories";
import type { TaskInfo } from "../../../src/types";

const mockProcessVaultFrontMatter = jest.fn();

jest.mock("tasknotes-nlp-core", () => ({
	NaturalLanguageParserCore: class {},
}), { virtual: true });

jest.mock("../../../src/services/VaultMutationService", () => ({
	...jest.requireActual("../../../src/services/VaultMutationService"),
	processVaultFrontMatter: (...args: unknown[]) => mockProcessVaultFrontMatter(...args),
}));

const recurring = (overrides: Partial<TaskInfo> = {}): TaskInfo =>
	TaskFactory.createTask({
		path: "tasks/review.md",
		status: "open",
		recurrence: "DTSTART:20261019;FREQ=WEEKLY",
		scheduled: "2026-10-19",
		complete_instances: [],
		skipped_instances: [],
		...overrides,
	});

function createView(storedTask: () => TaskInfo) {
	const toggleRecurringTaskComplete = jest.fn();
	const app = new App();
	(app.vault as any).getAbstractFileByPath = (path: string) => new TFile(path);
	const containerEl = document.createElement("div");
	document.body.appendChild(containerEl);
	const view = new TaskListView(
		{},
		containerEl,
		{
			app,
			cacheManager: { getTaskInfo: jest.fn(async () => storedTask()) },
			fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
			i18n: { translate: (message: unknown) => String(message) },
			priorityManager: { getAllPriorities: () => [] },
			settings: { fieldMapping: DEFAULT_FIELD_MAPPING },
			statusManager: {
				getAllStatuses: () => [],
				isCompletedStatus: (status: string) => status === "done",
			},
			taskService: { applyPropertyChangeSideEffects: jest.fn() },
			toggleRecurringTaskComplete,
		} as any
	);
	const internals = view as any;
	internals.getGroupByPropertyId = () => "note.status";
	internals.isListTypeProperty = () => false;
	internals.shouldEnableManualReordering = () => false;
	internals.showTaskMovementUndo = jest.fn();
	internals.debouncedRefresh = jest.fn();
	internals.currentTargetDate = new Date("2026-10-19T00:00:00Z");
	return { internals, toggleRecurringTaskComplete };
}

const move = (internals: any, path: string, groupKey = "done") =>
	internals.performTaskMovement(path, { groupKey: "open" }, { groupKey }, false, null);

describe("TaskListView recurring status moves", () => {
	beforeEach(() => {
		MockObsidian.reset();
		mockProcessVaultFrontMatter.mockClear();
		document.body.innerHTML = "";
	});

	it("completes the row's occurrence instead of writing Done on the series", async () => {
		const task = recurring();
		const { internals, toggleRecurringTaskComplete } = createView(() => task);
		internals.taskInfoCache.set(task.path, task);

		await move(internals, task.path);

		expect(toggleRecurringTaskComplete).toHaveBeenCalledTimes(1);
		expect(mockProcessVaultFrontMatter).not.toHaveBeenCalled();
		expect(internals.debouncedRefresh).toHaveBeenCalled();
	});

	it("does not complete the next occurrence from a row left over by a repeated move", async () => {
		const shown = recurring();
		const { internals, toggleRecurringTaskComplete } = createView(() =>
			recurring({ scheduled: "2026-10-26", complete_instances: ["2026-10-19"] })
		);
		internals.taskInfoCache.set(shown.path, shown);

		await move(internals, shown.path);

		expect(toggleRecurringTaskComplete).not.toHaveBeenCalled();
		expect(mockProcessVaultFrontMatter).not.toHaveBeenCalled();
	});

	it("leaves a move to another open status to the ordinary write path", async () => {
		const task = recurring();
		const { internals, toggleRecurringTaskComplete } = createView(() => task);
		internals.taskInfoCache.set(task.path, task);

		await move(internals, task.path, "in-progress");

		expect(toggleRecurringTaskComplete).not.toHaveBeenCalled();
		expect(mockProcessVaultFrontMatter).toHaveBeenCalledTimes(1);
	});
});
