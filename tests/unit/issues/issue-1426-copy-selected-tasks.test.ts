import {
	formatTasksForClipboard,
	type ClipboardTask,
} from "../../../src/utils/taskClipboard";

describe("Issue #1426: copy task lists", () => {
	const tasks: ClipboardTask[] = [
		{ path: "Tasks/2501041015.md", title: "Plan next actions" },
		{ path: "Tasks/Project follow-up.md", title: "Follow up with team" },
	];

	it("formats tasks as filenames for manual ordering", () => {
		expect(formatTasksForClipboard(tasks, "filenames")).toBe(
			"2501041015\nProject follow-up"
		);
	});

	it("formats tasks as markdown links", () => {
		const text = formatTasksForClipboard(
			tasks,
			"markdown-links",
			(task) => `TaskNotes/${task.path}`
		);

		expect(text).toBe(
			"[[TaskNotes/Tasks/2501041015.md]]\n[[TaskNotes/Tasks/Project follow-up.md]]"
		);
	});

	it("falls back to filenames when titles are unavailable", () => {
		expect(formatTasksForClipboard([{ path: "Tasks/Untitled.md" }], "titles")).toBe(
			"Untitled"
		);
	});

	it("formats tasks as paths", () => {
		expect(formatTasksForClipboard(tasks, "paths")).toBe(
			"Tasks/2501041015.md\nTasks/Project follow-up.md"
		);
	});
});
