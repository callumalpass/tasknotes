import { StatusBarService } from "../../../src/services/StatusBarService";

describe("Issue #1880: status bar with dash titles", () => {
	it("renders the tracked task status when the title contains a dash", async () => {
		const statusBarElement = document.createElement("div");
		const obsidianStatusBarElement = statusBarElement as HTMLElement & {
			empty: () => void;
			addClass: (...classes: string[]) => void;
		};
		obsidianStatusBarElement.empty = () => {
			statusBarElement.textContent = "";
		};
		obsidianStatusBarElement.addClass = (...classes: string[]) => {
			statusBarElement.classList.add(...classes);
		};

		const plugin = {
			settings: { showTrackedTasksInStatusBar: true },
			addStatusBarItem: jest.fn(() => obsidianStatusBarElement),
			cacheManager: {
				getAllTasks: jest.fn().mockResolvedValue([
					{
						title: "Planning - review",
						path: "Tasks/planning-review.md",
						status: "open",
						archived: false,
						timeEntries: [{ startTime: "2026-05-14T08:00:00.000Z" }],
					},
				]),
			},
			getActiveTimeSession: jest.fn((task) => task.timeEntries[0]),
		};

		const service = new StatusBarService(plugin as never);
		service.initialize();
		await (service as unknown as { updateStatusBar: () => Promise<void> }).updateStatusBar();

		expect(statusBarElement.textContent).toContain("Tracking: Planning - review");
		expect(statusBarElement.classList.contains("tn-static-display-none-6b99de8b")).toBe(false);

		service.destroy();
	});
});
