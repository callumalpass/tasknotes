/**
 * Issue #1235: blocked tasks should have a disclosure control for the tasks
 * they are waiting on, matching the existing "blocking" task-card toggle.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1235
 */

import { createTaskCard } from "../../../src/ui/TaskCard";
import type TaskNotesPlugin from "../../../src/main";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

function waitForAsyncRender(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 20));
}

function createPlugin(blocker = TaskFactory.createTask({ path: "Tasks/blocker.md" })) {
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

	plugin.app.metadataCache.getFirstLinkpathDest = jest.fn().mockReturnValue(null);
	plugin.cacheManager.getTaskInfo = jest.fn(async (path: string) =>
		path === blocker.path ? blocker : null
	);
	plugin.i18n.translate = jest.fn((key: string, vars?: Record<string, string | number>) => {
		const translations: Record<string, string> = {
			"ui.taskCard.blockedBadge": "Blocked",
			"ui.taskCard.blockingToggle": `Blocking ${vars?.count ?? 0} tasks`,
			"ui.taskCard.loadingDependencies": "Loading dependencies...",
			"ui.taskCard.blockingLoadError": "Failed to load dependencies",
			"ui.taskCard.taskOptions": "Task options",
			"ui.taskCard.priorityAriaLabel": `Priority: ${vars?.label ?? ""}`,
		};
		return translations[key] ?? key;
	});

	return plugin;
}

describe("Issue #1235: blocked tasks toggle arrow", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("renders a no-drag toggle for blocked-by dependencies", () => {
		const plugin = createPlugin();
		const task = TaskFactory.createTask({
			path: "Tasks/blocked.md",
			blockedBy: [{ uid: "Tasks/blocker.md", reltype: "FINISHTOSTART" }],
			isBlocked: true,
		});

		const card = createTaskCard(task, plugin);
		const toggle = card.querySelector<HTMLElement>(".task-card__blocked-toggle");
		const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });

		expect(toggle).not.toBeNull();
		expect(toggle?.getAttribute("data-tn-no-drag")).toBe("true");
		expect(toggle?.getAttribute("draggable")).toBe("false");

		toggle?.dispatchEvent(mouseDown);
		expect(mouseDown.defaultPrevented).toBe(true);
	});

	it("expands blocked tasks to show the tasks they are waiting on", async () => {
		const blocker = TaskFactory.createTask({
			path: "Tasks/blocker.md",
			title: "Blocking prerequisite",
		});
		const plugin = createPlugin(blocker);
		const task = TaskFactory.createTask({
			path: "Tasks/blocked.md",
			title: "Blocked task",
			blockedBy: [{ uid: "Tasks/blocker.md", reltype: "FINISHTOSTART" }],
			isBlocked: true,
		});

		const card = createTaskCard(task, plugin);
		document.body.appendChild(card);

		card.querySelector<HTMLElement>(".task-card__blocked-toggle")?.click();
		await waitForAsyncRender();

		const renderedBlockers = Array.from(
			card.querySelectorAll<HTMLElement>(".task-card__blocked-by > .task-card")
		);

		expect(renderedBlockers.map((blockerCard) => blockerCard.dataset.taskPath)).toEqual([
			blocker.path,
		]);
	});

	it("can show blocked-by and blocking toggles on the same task", () => {
		const plugin = createPlugin();
		const task = TaskFactory.createTask({
			path: "Tasks/middle.md",
			blockedBy: [{ uid: "Tasks/blocker.md", reltype: "FINISHTOSTART" }],
			blocking: ["Tasks/dependent.md"],
			isBlocked: true,
			isBlocking: true,
		});

		const card = createTaskCard(task, plugin);

		expect(card.querySelector(".task-card__blocked-toggle")).not.toBeNull();
		expect(card.querySelector(".task-card__blocking-toggle")).not.toBeNull();
	});
});
