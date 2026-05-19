import {
	getRenderedTaskPaths,
	planBasesTaskDeletedEvent,
	planBasesTaskUpdatedEvent,
} from "../../../src/bases/basesUpdateEvents";
import { TaskFactory } from "../../helpers/mock-factories";

describe("Bases update event helpers", () => {
	it("handles relevant updated task payloads without refreshing renamed paths", () => {
		const task = TaskFactory.createTask({
			path: "TaskNotes/Visible.md",
			title: "Visible",
		});

		expect(
			planBasesTaskUpdatedEvent(
				{ path: task.path, updatedTask: task },
				new Set(["TaskNotes/Visible.md"])
			)
		).toEqual({
			action: "handle-task",
			task,
		});
	});

	it("plans a refresh and cache swap when a relevant task path changes", () => {
		const originalTask = TaskFactory.createTask({
			path: "TaskNotes/Old.md",
			title: "Old",
		});
		const updatedTask = TaskFactory.createTask({
			...originalTask,
			path: "TaskNotes/New.md",
			title: "New",
		});

		expect(
			planBasesTaskUpdatedEvent(
				{ originalTask, updatedTask },
				new Set(["TaskNotes/Old.md"])
			)
		).toEqual({
			action: "refresh-renamed-task",
			removePath: "TaskNotes/Old.md",
			addPath: "TaskNotes/New.md",
		});
	});

	it("ignores invalid and unrelated update payloads", () => {
		const task = TaskFactory.createTask({
			path: "TaskNotes/Hidden.md",
		});

		expect(planBasesTaskUpdatedEvent(null, new Set(["TaskNotes/Visible.md"]))).toEqual({
			action: "ignore",
		});
		expect(
			planBasesTaskUpdatedEvent(
				{ updatedTask: task },
				new Set(["TaskNotes/Visible.md"])
			)
		).toEqual({
			action: "ignore",
		});
	});

	it("refreshes deleted-task events that touched rendered cards or project links", () => {
		expect(
			planBasesTaskDeletedEvent(
				{
					path: "TaskNotes/Rendered.md",
					prevCache: { frontmatter: {} },
				},
				{
					projectsField: "projects",
					renderedTaskPaths: new Set(["TaskNotes/Rendered.md"]),
				}
			)
		).toEqual({
			deletedPath: "TaskNotes/Rendered.md",
			shouldRefresh: true,
		});

		expect(
			planBasesTaskDeletedEvent(
				{
					path: "TaskNotes/Child.md",
					prevCache: { frontmatter: { projectLinks: "[[Parent]]" } },
				},
				{
					projectsField: "projectLinks",
					renderedTaskPaths: new Set(),
				}
			)
		).toEqual({
			deletedPath: "TaskNotes/Child.md",
			shouldRefresh: true,
		});
	});

	it("does not refresh unrelated deleted-task events", () => {
		expect(
			planBasesTaskDeletedEvent(
				{
					path: "Notes/Plain note.md",
					prevCache: { frontmatter: {} },
				},
				{
					projectsField: "projects",
					renderedTaskPaths: new Set(["TaskNotes/Rendered.md"]),
				}
			)
		).toEqual({
			deletedPath: "Notes/Plain note.md",
			shouldRefresh: false,
		});
	});

	it("extracts rendered task paths from task cards", () => {
		const root = document.createElement("div");
		const first = document.createElement("div");
		first.className = "task-card";
		first.dataset.taskPath = "TaskNotes/A.md";
		const second = document.createElement("div");
		second.className = "task-card";
		second.dataset.taskPath = "TaskNotes/B.md";
		const unrelated = document.createElement("div");
		unrelated.dataset.taskPath = "TaskNotes/C.md";
		root.append(first, second, unrelated);

		expect(Array.from(getRenderedTaskPaths(root))).toEqual([
			"TaskNotes/A.md",
			"TaskNotes/B.md",
		]);
	});
});
