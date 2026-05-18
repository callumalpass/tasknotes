/**
 * Issue #922: dependency display behavior on task cards.
 *
 * Blocked tasks should show their visible blocked status, let that blocked
 * indicator expand the blocker cards, and render TaskDependency entries in the
 * blockedBy property as clickable task links.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/922
 */

import { TFile } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import { createTaskCard } from "../../../src/ui/TaskCard";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

function waitForAsyncRender(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 20));
}

function createPlugin(
	blocker = TaskFactory.createTask({ path: "Tasks/blocker.md" })
): TaskNotesPlugin {
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
	plugin.cacheManager.getTaskInfo = jest.fn(async (path: string) =>
		path === blocker.path ? blocker : null
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

	it("lets the blocked visible property expand blocker task cards", async () => {
		const blocker = TaskFactory.createTask({
			path: "Tasks/blocker.md",
			title: "Blocking prerequisite",
		});
		const plugin = createPlugin(blocker);
		const task = TaskFactory.createTask({
			path: "Tasks/blocked.md",
			blockedBy: [{ uid: "[[Tasks/blocker.md]]", reltype: "FINISHTOSTART" }],
			isBlocked: true,
		});

		const card = createTaskCard(task, plugin, ["blocked"], { showSecondaryBadges: false });
		document.body.appendChild(card);

		expect(card.querySelector(".task-card__blocked-toggle")).toBeNull();

		card.querySelector<HTMLElement>(".task-card__metadata-pill--blocked")?.click();
		await waitForAsyncRender();

		const renderedBlockers = Array.from(
			card.querySelectorAll<HTMLElement>(".task-card__blocked-by > .task-card")
		);

		expect(renderedBlockers.map((blockerCard) => blockerCard.dataset.taskPath)).toEqual([
			blocker.path,
		]);
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
