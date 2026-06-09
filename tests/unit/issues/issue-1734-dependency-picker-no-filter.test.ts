import { taskMatchesSelectorQuery } from "../../../src/modals/TaskSelectorWithCreateModal";
import { TaskInfo } from "../../../src/types";

function task(overrides: Partial<TaskInfo>): TaskInfo {
	return {
		title: "Example task",
		path: "Tasks/example.md",
		archived: false,
		status: "open",
		priority: "normal",
		tags: [],
		contexts: [],
		projects: [],
		...overrides,
	};
}

describe("Issue #1734 dependency picker search filtering", () => {
	it("does not crash when a task has a numeric priority value", () => {
		const numericPriorityTask = task({
			title: "Draft launch post",
			priority: 1 as unknown as string,
		});

		expect(() => taskMatchesSelectorQuery(numericPriorityTask, "draft")).not.toThrow();
		expect(() => taskMatchesSelectorQuery(numericPriorityTask, "1")).not.toThrow();
		expect(taskMatchesSelectorQuery(numericPriorityTask, "draft")).toBe(true);
		expect(taskMatchesSelectorQuery(numericPriorityTask, "1")).toBe(true);
	});

	it("filters across task title, due date, contexts, projects, and priority", () => {
		const matchingTask = task({
			title: "Fix login bug",
			due: "2026-04-03",
			priority: "high",
			contexts: ["@dev"],
			projects: ["[[App v2]]"],
		});

		expect(taskMatchesSelectorQuery(matchingTask, "bug")).toBe(true);
		expect(taskMatchesSelectorQuery(matchingTask, "2026-04")).toBe(true);
		expect(taskMatchesSelectorQuery(matchingTask, "high")).toBe(true);
		expect(taskMatchesSelectorQuery(matchingTask, "@dev")).toBe(true);
		expect(taskMatchesSelectorQuery(matchingTask, "app v2")).toBe(true);
		expect(taskMatchesSelectorQuery(matchingTask, "dentist")).toBe(false);
	});
});
