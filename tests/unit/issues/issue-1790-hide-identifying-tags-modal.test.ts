import { App } from "obsidian";
import { TagSuggest } from "../../../src/modals/taskModalSuggests";
import { NLPSuggest } from "../../../src/modals/taskCreationSuggest";
import { TaskEditModal } from "../../../src/modals/TaskEditModal";
import { buildTaskEditChanges, type TaskEditChangeInput } from "../../../src/modals/taskEditChanges";
import type { TaskInfo } from "../../../src/types";
import { MockObsidian } from "../../helpers/obsidian-runtime";

const createMockApp = (mockApp: unknown): App => mockApp as App;

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Tagged task",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Tagged task.md",
		archived: false,
		tags: ["task", "work"],
		contexts: [],
		projects: [],
		...overrides,
	};
}

function createPlugin(settings: Record<string, unknown> = {}, tags: string[] = []) {
	return {
		settings: {
			taskTag: "task",
			taskIdentificationMethod: "tag",
			hideIdentifyingTagsInCards: true,
			statusSuggestionTrigger: "/",
			userFields: [],
			maintainDueDateOffsetInRecurring: false,
			...settings,
		},
		cacheManager: {
			getAllTags: jest.fn(() => tags),
		},
		statusManager: {
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
		fieldMapper: {
			toUserField: jest.fn((key: string) => key),
		},
	};
}

function createEditInput(
	task: TaskInfo,
	overrides: Partial<TaskEditChangeInput> = {}
): TaskEditChangeInput {
	return {
		task,
		title: task.title,
		dueDate: "",
		scheduledDate: "",
		priority: task.priority,
		status: task.status,
		contexts: "",
		projects: "",
		tags: "",
		initialTags: "",
		timeEstimate: 0,
		recurrenceRule: "",
		recurrenceAnchor: "scheduled" as const,
		reminders: [],
		blockedByItems: [],
		initialBlockedBy: [],
		blockingItems: [],
		initialBlockingPaths: [],
		details: "",
		originalDetails: "",
		completedInstancesChanges: [],
		skippedInstancesChanges: [],
		userFields: {},
		frontmatter: {},
		userFieldConfigs: [],
		taskIdentificationMethod: "tag",
		taskTag: "task",
		maintainDueDateOffsetInRecurring: false,
		normalizeDetails: (value: string) => value,
		...overrides,
	};
}

describe("issue #1790 identifying tags in task modals", () => {
	let app: App;

	beforeEach(() => {
		MockObsidian.reset();
		app = createMockApp(MockObsidian.createMockApp());
		document.body.innerHTML = "";
	});

	it("hides the task tag and hierarchical children from the edit modal tag field", async () => {
		const task = createTask({ tags: ["task", "task/project", "work"] });
		const modal = new TaskEditModal(app, createPlugin() as never, { task });
		(modal as unknown as { initializeSubtasks: jest.Mock }).initializeSubtasks = jest
			.fn()
			.mockResolvedValue(undefined);

		await modal.initializeFormData();

		expect((modal as unknown as { tags: string }).tags).toBe("work");
	});

	it("filters identifying tags from tag field autocomplete when the hide setting is enabled", async () => {
		const plugin = createPlugin({}, ["task", "task/project", "taskish", "work"]);
		const input = document.createElement("input");
		document.body.appendChild(input);
		const suggest = new TagSuggest(app, input, plugin as never);

		const suggestions = await (suggest as unknown as {
			getSuggestions(query: string): Promise<Array<{ value: string }>>;
		}).getSuggestions("");

		expect(suggestions.map((suggestion) => suggestion.value)).toEqual(["taskish", "work"]);
	});

	it("leaves autocomplete unchanged when the hide setting is disabled", async () => {
		const plugin = createPlugin({ hideIdentifyingTagsInCards: false }, [
			"task",
			"task/project",
			"work",
		]);
		const input = document.createElement("input");
		document.body.appendChild(input);
		const suggest = new TagSuggest(app, input, plugin as never);

		const suggestions = await (suggest as unknown as {
			getSuggestions(query: string): Promise<Array<{ value: string }>>;
		}).getSuggestions("");

		expect(suggestions.map((suggestion) => suggestion.value)).toEqual([
			"task",
			"task/project",
			"work",
		]);
	});

	it("filters identifying tags from NLP tag autocomplete", () => {
		const plugin = createPlugin({}, ["task", "task/project", "taskish", "work"]);
		const input = document.createElement("textarea");
		document.body.appendChild(input);
		const suggest = new NLPSuggest(app, input, plugin as never);

		const suggestions = (suggest as unknown as {
			getTagSuggestions(query: string): Array<{ value: string }>;
		}).getTagSuggestions("");

		expect(suggestions.map((suggestion) => suggestion.value)).toEqual(["taskish", "work"]);
	});

	it("preserves hidden hierarchical identifying tags when other tags change", () => {
		const task = createTask({ tags: ["task/project", "work"] });
		const result = buildTaskEditChanges(
			createEditInput(task, {
				tags: "work, urgent",
				initialTags: "work",
			})
		);

		expect(result.changes.tags).toEqual(["task/project", "urgent", "work"]);
		expect(result.changes.tags).not.toContain("task");
	});
});
