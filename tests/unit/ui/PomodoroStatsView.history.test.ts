import type { WorkspaceLeaf } from "obsidian";
import { PomodoroStatsView } from "../../../src/views/PomodoroStatsView";
import type { PomodoroSessionHistory, TaskInfo } from "../../../src/types";
import { TaskFactory } from "../../helpers/mock-factories";
import { observeTranslation } from "../../helpers/real-i18n";

function session(taskPath?: string): PomodoroSessionHistory {
	return {
		id: taskPath ?? "unassigned", taskPath, type: "work", completed: true,
		startTime: "2026-11-06T09:00:00Z", endTime: "2026-11-06T09:25:00Z",
		plannedDuration: 25, activePeriods: [],
	};
}

function fixture(getTaskInfo: (path: string) => Promise<TaskInfo | null>) {
	const plugin = { cacheManager: { getTaskInfo }, settings: { calendarViewSettings: { timeFormat: "24" } }, i18n: { translate: observeTranslation() } };
	const view = new PomodoroStatsView({} as WorkspaceLeaf, plugin as unknown as ConstructorParameters<typeof PomodoroStatsView>[1]);
	const container = document.createElement("div");
	const internals = view as unknown as { renderRecentSessions(container: HTMLElement, history: PomodoroSessionHistory[]): Promise<void> };
	return { view, container, render: (history: PomodoroSessionHistory[]) => internals.renderRecentSessions(container, history) };
}

describe("Pomodoro history task identity", () => {
	it("uses the shared title and falls back to the basename only for unresolved tasks", async () => {
		const task = TaskFactory.createTask({ path: "Tasks/00.md", title: "Prepare the release decision" });
		const { container, render } = fixture(async path => path === task.path ? task : null);
		await render([session(), session("Tasks/Missing.MD"), session(task.path)]);
		expect(Array.from(container.querySelectorAll(".session-task"), element => element.textContent)).toEqual([task.title, "Missing", ""]);
	});

	it("does not replace newer history after a slow title lookup", async () => {
		let finishLookup: (task: TaskInfo) => void = () => undefined;
		const pending = new Promise<TaskInfo>(resolve => { finishLookup = resolve; });
		const { container, render } = fixture(async path => path === "Tasks/Old.md" ? pending : null);
		const older = render([session("Tasks/Old.md")]);
		await render([session("Tasks/New.md")]);
		finishLookup(TaskFactory.createTask({ path: "Tasks/Old.md", title: "Old title" }));
		await older;
		expect(container.querySelector(".session-task")?.textContent).toBe("New");
	});
});
