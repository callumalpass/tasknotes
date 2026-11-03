import { observeTranslation as mockObserveTranslation } from "../../helpers/real-i18n";
import { TaskSelectorWithCreateModal } from "../../../src/modals/TaskSelectorWithCreateModal";
import { TaskInfo } from "../../../src/types";
import { MockObsidian } from "../../helpers/obsidian-runtime";
import type { App } from "obsidian";

function task(overrides: Partial<TaskInfo>): TaskInfo {
	return {
		title: "Example task",
		path: `Tasks/${overrides.title || "example"}.md`,
		archived: false,
		status: "open",
		priority: "normal",
		tags: [],
		contexts: [],
		projects: [],
		...overrides,
	};
}

function occurrence(date: string, parentLink = "[[Tasks/Weekly review]]"): TaskInfo {
	return task({
		title: "Weekly review",
		path: `Tasks/Weekly review ${date}.md`,
		recurrence_parent: parentLink,
		occurrence_date: date,
	});
}

function createModal(tasks: TaskInfo[]): TaskSelectorWithCreateModal {
	const mockApp = MockObsidian.createMockApp() as App;
	const mockPlugin = {
		app: mockApp,
		settings: {
			defaultTaskStatus: "open",
			customStatuses: [],
			customPriorities: [],
			nlpDefaultToScheduled: true,
			nlpLanguage: "en",
			nlpTriggers: { enabled: true, triggers: [] },
			userFields: [],
			calendarViewSettings: { locale: "en" },
		},
		i18n: { translate: mockObserveTranslation() },
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
			getStatusConfig: jest.fn(() => null),
		},
	} as any;

	return new TaskSelectorWithCreateModal(mockApp, mockPlugin, tasks, {
		onResult: jest.fn(),
		allowCreate: false,
		targetDate: new Date("2026-06-20T00:00:00"),
	});
}

const parent = task({ title: "Weekly review", recurrence: "FREQ=WEEKLY" });
const june1 = occurrence("2026-06-01");
const june8 = occurrence("2026-06-08");
const may25 = occurrence("2026-05-25");
const other = task({ title: "Pay rent" });

const paths = (tasks: TaskInfo[]) => tasks.map((t) => t.path);

describe("task selector: occurrence notes", () => {
	beforeEach(() => MockObsidian.reset());

	it("hides occurrence notes behind their listed parent", () => {
		const modal = createModal([parent, june1, june8, other]);

		expect(paths(modal.getSuggestions("")).sort()).toEqual([other.path, parent.path]);
		expect(paths(modal.getSuggestions("weekly"))).toEqual([parent.path]);
	});

	it("keeps an occurrence note visible when its parent is not listed", () => {
		const modal = createModal([june1, other]);

		expect(paths(modal.getSuggestions("weekly"))).toEqual([june1.path]);
	});

	it("keeps occurrence notes visible when their parent is archived", () => {
		const modal = createModal([{ ...parent, archived: true }, june1, other]);

		expect(paths(modal.getSuggestions("weekly"))).toEqual([june1.path]);
	});

	it("reveals occurrence notes for an ISO month or day in the query", () => {
		const modal = createModal([parent, june1, june8, may25, other]);

		expect(paths(modal.getSuggestions("2026-06"))).toEqual(
			expect.arrayContaining([june1.path, june8.path])
		);
		expect(modal.getSuggestions("2026-06")).toHaveLength(2);
		expect(paths(modal.getSuggestions("weekly 2026-06-08"))).toEqual([june8.path]);
		expect(paths(modal.getSuggestions("rent 2026-06"))).toEqual([]);
		expect(paths(modal.getSuggestions("weekly 2026-06-0"))).toEqual(
			expect.arrayContaining([june1.path, june8.path])
		);
		expect(paths(modal.getSuggestions("2026-05-2"))).toEqual([may25.path]);
	});

	it("does not treat a bare year as a date in the main list", () => {
		const modal = createModal([parent, june1, other]);

		expect(paths(modal.getSuggestions("2026"))).toEqual([]);
	});

	it("drills into a parent: parent first, then notes newest first, filterable by year or date", () => {
		const modal = createModal([parent, may25, june1, june8, other]);
		(modal as any).setDrillParent(parent);

		expect(paths(modal.getSuggestions(""))).toEqual([
			parent.path,
			june8.path,
			june1.path,
			may25.path,
		]);
		expect(paths(modal.getSuggestions("2026-05"))).toEqual([may25.path]);
		expect(modal.getSuggestions("2026")).toHaveLength(3);

		(modal as any).setDrillParent(null);
		expect(paths(modal.getSuggestions("")).sort()).toEqual([other.path, parent.path]);
	});
});
