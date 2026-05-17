import { resolveNestedTaskCardDragSource } from "../../../src/bases/kanbanDragUtils";

describe("Issue #1219: Kanban subtask drag source resolution", () => {
	function createExpandedSubtaskCard() {
		const wrapper = document.createElement("div");
		wrapper.className = "kanban-view__card-wrapper";
		wrapper.dataset.taskPath = "tasks/project.md";

		const parentCard = document.createElement("div");
		parentCard.className = "task-card";
		parentCard.dataset.taskPath = "tasks/project.md";

		const subtasks = document.createElement("div");
		subtasks.className = "task-card__subtasks";

		const firstSubtask = document.createElement("div");
		firstSubtask.className = "task-card task-card--subtask";
		firstSubtask.dataset.taskPath = "tasks/subtask-1.md";

		const secondSubtask = document.createElement("div");
		secondSubtask.className = "task-card task-card--subtask";
		secondSubtask.dataset.taskPath = "tasks/subtask-2.md";

		const secondSubtaskTitle = document.createElement("span");
		secondSubtaskTitle.className = "task-card__title-text";
		secondSubtaskTitle.textContent = "Subtask 2";
		secondSubtask.appendChild(secondSubtaskTitle);

		subtasks.append(firstSubtask, secondSubtask);
		parentCard.appendChild(subtasks);
		wrapper.appendChild(parentCard);

		return { wrapper, parentCard, secondSubtask, secondSubtaskTitle };
	}

	it("uses the nested subtask path when a Kanban drag starts inside an expanded subtask", () => {
		const { wrapper, secondSubtaskTitle, secondSubtask } = createExpandedSubtaskCard();

		const source = resolveNestedTaskCardDragSource(secondSubtaskTitle, wrapper);

		expect(source).toEqual({
			taskPath: "tasks/subtask-2.md",
			sourceElement: secondSubtask,
		});
	});

	it("falls back to the parent task when the drag starts on the parent card", () => {
		const { wrapper, parentCard } = createExpandedSubtaskCard();

		expect(resolveNestedTaskCardDragSource(parentCard, wrapper)).toBeNull();
	});

	it("ignores nested cards outside the active Kanban wrapper", () => {
		const { secondSubtaskTitle } = createExpandedSubtaskCard();
		const otherWrapper = document.createElement("div");
		otherWrapper.className = "kanban-view__card-wrapper";

		expect(resolveNestedTaskCardDragSource(secondSubtaskTitle, otherWrapper)).toBeNull();
	});
});
