import { StatusBarService } from "../../../src/services/StatusBarService";

function createStatusBarElement(): HTMLElement {
	const statusBarElement = document.createElement("div");

	(statusBarElement as HTMLElement & { addClass: (...classes: string[]) => void }).addClass = (
		...classes: string[]
	) => {
		statusBarElement.classList.add(...classes);
	};

	return statusBarElement;
}

function createPlugin(tasks: Array<Record<string, unknown>>) {
	const statusBarElement = createStatusBarElement();
	const plugin = {
		settings: { showTrackedTasksInStatusBar: true },
		addStatusBarItem: jest.fn(() => statusBarElement),
		cacheManager: {
			getAllTasks: jest.fn().mockResolvedValue(tasks),
		},
		getActiveTimeSession: jest.fn((task) => {
			const entry = (task as { timeEntries?: Array<{ startTime: string; endTime?: string }> })
				.timeEntries?.[0];
			return entry && !entry.endTime ? entry : null;
		}),
		app: {
			vault: {
				getAbstractFileByPath: jest.fn(),
			},
			workspace: {
				getLeaf: jest.fn(),
			},
		},
	};

	return { plugin, statusBarElement };
}

describe("Issue #1655: time tracking status widget", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it("shows a live elapsed timer for a tracked task", async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-02-28T20:02:05.000Z"));

		const { plugin, statusBarElement } = createPlugin([
			{
				title: "Timer task",
				path: "Tasks/timer-task.md",
				status: "open",
				archived: false,
				timeEntries: [{ startTime: "2026-02-28T20:00:00.000Z" }],
			},
		]);

		const service = new StatusBarService(plugin as never);
		service.initialize();
		await (service as unknown as { updateStatusBar: () => Promise<void> }).updateStatusBar();

		expect(statusBarElement.textContent).toContain("Tracking: Timer task (2:05)");
		expect(
			statusBarElement.querySelector(".tasknotes-status-icon")?.getAttribute("data-icon")
		).toBe("timer");
		expect(statusBarElement.getAttribute("data-tooltip")).toContain("Elapsed: 2:05");

		jest.advanceTimersByTime(1000);

		expect(statusBarElement.textContent).toContain("Tracking: Timer task (2:06)");
		expect(plugin.cacheManager.getAllTasks).toHaveBeenCalledTimes(1);

		service.destroy();
	});

	it("shows a total elapsed timer when multiple tasks are tracked", async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-02-28T20:05:00.000Z"));

		const { plugin, statusBarElement } = createPlugin([
			{
				title: "First task",
				path: "Tasks/first-task.md",
				status: "open",
				archived: false,
				timeEntries: [{ startTime: "2026-02-28T20:00:00.000Z" }],
			},
			{
				title: "Second task",
				path: "Tasks/second-task.md",
				status: "open",
				archived: false,
				timeEntries: [{ startTime: "2026-02-28T20:03:30.000Z" }],
			},
		]);

		const service = new StatusBarService(plugin as never);
		service.initialize();
		await (service as unknown as { updateStatusBar: () => Promise<void> }).updateStatusBar();

		expect(statusBarElement.textContent).toContain("Tracking 2 tasks (6:30 total)");
		expect(statusBarElement.getAttribute("data-tooltip")).toContain("First task - 5:00");
		expect(statusBarElement.getAttribute("data-tooltip")).toContain("Second task - 1:30");

		service.destroy();
	});
});
