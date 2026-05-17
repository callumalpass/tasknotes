/**
 * Issue #922: dependency display behavior on task cards.
 *
 * Blocked tasks should show their visible blocked status, and TaskDependency
 * entries in the blockedBy property should render as clickable task links.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/922
 */

import { TFile } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import { createTaskCard } from "../../../src/ui/TaskCard";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

function createPlugin(): TaskNotesPlugin {
	const plugin = PluginFactory.createMockPlugin({
		priorityManager: {
			getPriorityConfig: jest.fn().mockReturnValue({ color: "#666666", label: "Normal" }),
			getPriorityWeight: jest.fn().mockReturnValue(0),
		},
		statusManager: {
			isCompletedStatus: jest.fn().mockReturnValue(false),
			getCompletedStatuses: jest.fn(() => ["done"]),
			getStatusConfig: jest.fn().mockReturnValue({ color: "#666666" }),
			getNextStatus: jest.fn().mockReturnValue("done"),
		},
		projectSubtasksService: {
			isTaskUsedAsProjectSync: jest.fn().mockReturnValue(false),
			isTaskUsedAsProject: jest.fn().mockResolvedValue(false),
			sortTasks: jest.fn((tasks) => tasks),
		},
	}) as TaskNotesPlugin;

	plugin.app.metadataCache.getFirstLinkpathDest = jest
		.fn()
		.mockImplementation((path: string) =>
			path === "Tasks/blocker.md" ? new TFile("Tasks/blocker.md") : null
		);
	plugin.i18n.translate = jest.fn((key: string, vars?: Record<string, string | number>) => {
		const translations: Record<string, string> = {
			"ui.taskCard.blockedBadge": "Blocked",
			"ui.taskCard.blockedBadgeTooltip": "This task is blocked",
			"ui.taskCard.taskOptions": "Task options",
			"ui.taskCard.priorityAriaLabel": `Priority: ${vars?.label ?? ""}`,
		};
		return translations[key] ?? key;
	});

	return plugin;
}

describe("Issue #922: dependency display behavior", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("renders the blocked visible property when a task is actively blocked", () => {
		const plugin = createPlugin();
		const task = TaskFactory.createTask({
			path: "Tasks/blocked.md",
			blockedBy: [{ uid: "[[Tasks/blocker.md]]", reltype: "FINISHTOSTART" }],
			isBlocked: true,
		});

		const card = createTaskCard(task, plugin, ["blocked"]);
		const blockedPill = card.querySelector<HTMLElement>(".task-card__metadata-pill--blocked");

		expect(blockedPill).not.toBeNull();
		expect(blockedPill?.textContent).toBe("Blocked (1)");
	});

	it("renders blockedBy TaskDependency entries as clickable task links", () => {
		const plugin = createPlugin();
		const task = TaskFactory.createTask({
			path: "Tasks/blocked.md",
			blockedBy: [{ uid: "[[Tasks/blocker.md]]", reltype: "FINISHTOSTART" }],
			isBlocked: true,
		});

		const card = createTaskCard(task, plugin, ["blockedBy"]);
		const blockedByProperty = card.querySelector<HTMLElement>(
			".task-card__metadata-property--blockedBy"
		);
		const link = blockedByProperty?.querySelector<HTMLElement>(".internal-link");

		expect(blockedByProperty?.textContent).toContain("Blocked by:");
		expect(link).not.toBeNull();
		expect(link?.textContent).toBe("blocker");
		expect(link?.getAttribute("data-href")).toBe("Tasks/blocker.md");
	});
});
