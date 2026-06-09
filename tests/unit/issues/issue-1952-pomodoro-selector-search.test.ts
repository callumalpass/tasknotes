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
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
			getStatusConfig: jest.fn(() => null),
		},
	} as any;

	return new TaskSelectorWithCreateModal(mockApp, mockPlugin, tasks, {
		onResult: jest.fn(),
		targetDate: new Date("2026-05-27T00:00:00"),
	});
}

describe("Issue #1952: Pomodoro selector search ordering", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("ranks task title matches ahead of metadata-only matches", () => {
		const modal = createModal([
			task({ title: "Annual review", due: "2026-03-28", contexts: ["coi"] }),
			task({ title: "COI inbox", due: "2026-12-31" }),
			task({ title: "Archive COI receipts", due: "2026-06-09" }),
		]);

		const titles = modal.getSuggestions("coi").map((suggestion) => suggestion.title);

		expect(titles).toEqual(["COI inbox", "Archive COI receipts", "Annual review"]);
	});

	it("sorts equally relevant title matches by title before due date", () => {
		const modal = createModal([
			task({ title: "COI Zeta", due: "2026-03-28" }),
			task({ title: "COI Alpha", due: "2026-12-31" }),
			task({ title: "COI Middle", due: "2026-06-09" }),
		]);

		const titles = modal.getSuggestions("coi").map((suggestion) => suggestion.title);

		expect(titles).toEqual(["COI Alpha", "COI Middle", "COI Zeta"]);
	});
});
