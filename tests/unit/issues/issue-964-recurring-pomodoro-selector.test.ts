import fs from "fs";
import path from "path";
import type { TaskInfo } from "../../../src/types";
import {
	getTaskInstanceStatus,
	getTaskWithInstanceStatus,
	isTaskInstanceCompleted,
} from "../../../src/utils/taskInstanceStatus";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

const statusManager = {
	getCompletedStatuses: () => ["done"],
	isCompletedStatus: (status: string) => status === "done",
};

function createTask(overrides: Partial<TaskInfo>): TaskInfo {
	return {
		title: "Recurring standup",
		path: "tasks/recurring-standup.md",
		status: "open",
		priority: "normal",
		archived: false,
		...overrides,
	} as TaskInfo;
}

describe("Issue #964: recurring Pomodoro selector status", () => {
	const today = new Date(2026, 4, 17, 12);

	it("treats uncompleted recurring instances as open even when the stored status is completed", () => {
		const task = createTask({
			status: "done",
			recurrence: "RRULE:FREQ=DAILY",
			complete_instances: ["2026-05-16"],
		});

		expect(isTaskInstanceCompleted(task, today, statusManager, "open")).toBe(false);
		expect(getTaskInstanceStatus(task, today, statusManager, "open")).toBe("open");
		expect(getTaskWithInstanceStatus(task, today, statusManager, "open").status).toBe(
			"open"
		);
	});

	it("keeps custom in-progress statuses for uncompleted recurring instances", () => {
		const task = createTask({
			status: "in-progress",
			recurrence: "RRULE:FREQ=DAILY",
			complete_instances: ["2026-05-16"],
		});

		expect(getTaskInstanceStatus(task, today, statusManager, "open")).toBe("in-progress");
	});

	it("marks the recurring instance completed when today's date is in complete_instances", () => {
		const task = createTask({
			status: "open",
			recurrence: "RRULE:FREQ=DAILY",
			complete_instances: ["2026-05-17"],
		});

		expect(isTaskInstanceCompleted(task, today, statusManager, "open")).toBe(true);
		expect(getTaskInstanceStatus(task, today, statusManager, "open")).toBe("done");
	});

	it("keeps non-recurring completed tasks completed", () => {
		const task = createTask({
			status: "done",
		});

		expect(isTaskInstanceCompleted(task, today, statusManager, "open")).toBe(true);
		expect(getTaskInstanceStatus(task, today, statusManager, "open")).toBe("done");
	});

	it("uses instance-aware status in the selector and Pomodoro task card", () => {
		const selectorSource = readRepoFile("src/modals/TaskSelectorWithCreateModal.ts");
		const pomodoroViewSource = readRepoFile("src/views/PomodoroView.ts");
		const pomodoroServiceSource = readRepoFile("src/services/PomodoroService.ts");

		expect(selectorSource).toContain("isTaskInstanceCompleted(");
		expect(selectorSource).toContain("getTaskWithInstanceStatus(");
		expect(selectorSource).toContain("targetDate: this.targetDate");
		expect(pomodoroViewSource).toContain("getTaskWithInstanceStatus(");
		expect(pomodoroViewSource).toContain("isTaskInstanceCompleted(");
		expect(pomodoroServiceSource).toContain("isTaskInstanceCompleted(");
	});
});
