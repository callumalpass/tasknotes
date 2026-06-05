import {
	applyKanbanTaskDropFrontmatterPlan,
	clearKanbanDropMarkers,
	getKanbanCardDropTargetFromClientY,
	getKanbanDraggedPaths,
	kanbanDropPlanNeedsWrite,
	performKanbanOptimisticReorder,
	planKanbanDropSideEffect,
	planKanbanStatusDerivativeUpdate,
	planKanbanTaskDropUpdate,
	reconstructKanbanDropTargetFromContainer,
	resolveKanbanContainerDropTarget,
	updateKanbanDropMarker,
	type KanbanDropTarget,
} from "../../../src/bases/kanbanDragUtils";
import type { TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/a.md",
		archived: false,
		...overrides,
	};
}

function createCard(path: string): HTMLElement {
	const card = document.createElement("div");
	card.className = "kanban-view__card-wrapper";
	card.dataset.taskPath = path;
	return card;
}

function taskPaths(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll<HTMLElement>(".kanban-view__card-wrapper")).map(
		(card) => card.dataset.taskPath ?? ""
	);
}

describe("kanbanDragUtils", () => {
	describe("resolveKanbanContainerDropTarget", () => {
		const staleTarget: KanbanDropTarget = { taskPath: "Tasks/stale.md", above: true };
		const fallbackTarget: KanbanDropTarget = { taskPath: "Tasks/fallback.md", above: false };

		it("clears a stale cross-scope target", () => {
			expect(
				resolveKanbanContainerDropTarget({
					dropTarget: staleTarget,
					isCrossScope: true,
					targetInDropScope: false,
					fallbackDropTarget: fallbackTarget,
				})
			).toBeUndefined();
		});

		it("uses a fallback target for same-scope drops without a card target", () => {
			expect(
				resolveKanbanContainerDropTarget({
					dropTarget: undefined,
					isCrossScope: false,
					targetInDropScope: false,
					fallbackDropTarget: fallbackTarget,
				})
			).toEqual(fallbackTarget);
		});

		it("keeps a cross-scope target that belongs to the drop scope", () => {
			expect(
				resolveKanbanContainerDropTarget({
					dropTarget: staleTarget,
					isCrossScope: true,
					targetInDropScope: true,
				})
			).toEqual(staleTarget);
		});
	});

	it("returns a cloned batch path list when batch paths exist", () => {
		const batchPaths = ["Tasks/a.md", "Tasks/b.md"];
		const result = getKanbanDraggedPaths(batchPaths, "Tasks/fallback.md");

		expect(result).toEqual(batchPaths);
		expect(result).not.toBe(batchPaths);
	});

	it("resolves card drop position from the final client coordinate", () => {
		const target = createCard("Tasks/b.md");
		target.getBoundingClientRect = jest.fn(
			() =>
				({
					top: 100,
					bottom: 140,
					height: 40,
					left: 0,
					right: 200,
					width: 200,
				}) as DOMRect
		);

		expect(getKanbanCardDropTargetFromClientY(target, "Tasks/b.md", 110)).toEqual({
			taskPath: "Tasks/b.md",
			above: true,
		});
		expect(getKanbanCardDropTargetFromClientY(target, "Tasks/b.md", 125)).toEqual({
			taskPath: "Tasks/b.md",
			above: false,
		});
	});

	it("reconstructs a coordinate-based target from visible non-dragged cards", () => {
		const cards = document.createElement("div");
		const dragged = createCard("Tasks/a.md");
		const first = createCard("Tasks/b.md");
		const second = createCard("Tasks/c.md");
		cards.append(dragged, first, second);
		first.getBoundingClientRect = jest.fn(
			() =>
				({
					top: 100,
					bottom: 140,
					height: 40,
					left: 0,
					right: 200,
					width: 200,
				}) as DOMRect
		);
		second.getBoundingClientRect = jest.fn(
			() =>
				({
					top: 160,
					bottom: 200,
					height: 40,
					left: 0,
					right: 200,
					width: 200,
				}) as DOMRect
		);

		expect(
			reconstructKanbanDropTargetFromContainer({
				cardsContainer: cards,
				draggedTaskPaths: ["Tasks/a.md"],
				currentInsertionIndex: 0,
				clientY: 195,
			})
		).toEqual({ taskPath: "Tasks/c.md", above: false });
	});

	it("reconstructs insertion-index targets when no final coordinate is available", () => {
		const cards = document.createElement("div");
		cards.append(createCard("Tasks/a.md"), createCard("Tasks/b.md"), createCard("Tasks/c.md"));

		expect(
			reconstructKanbanDropTargetFromContainer({
				cardsContainer: cards,
				draggedTaskPaths: ["Tasks/a.md"],
				currentInsertionIndex: 0,
			})
		).toEqual({ taskPath: "Tasks/b.md", above: true });
		expect(
			reconstructKanbanDropTargetFromContainer({
				cardsContainer: cards,
				draggedTaskPaths: ["Tasks/a.md"],
				currentInsertionIndex: 2,
			})
		).toEqual({ taskPath: "Tasks/c.md", above: false });
	});

	it("marks the card where the active drop gap is shown", () => {
		const cards = document.createElement("div");
		const first = createCard("Tasks/a.md");
		const second = createCard("Tasks/b.md");
		const third = createCard("Tasks/c.md");
		cards.append(first, second, third);

		updateKanbanDropMarker(cards, [first, second, third], 1);

		expect(first.classList.contains("kanban-view__card-wrapper--drop-marker")).toBe(false);
		expect(second.classList.contains("kanban-view__card-wrapper--drop-marker")).toBe(true);
		expect(third.classList.contains("kanban-view__card-wrapper--drop-marker")).toBe(false);
		expect(cards.classList.contains("kanban-view__cards--drop-marker-end")).toBe(false);
	});

	it("marks the end of a card container for append drops", () => {
		const cards = document.createElement("div");
		const first = createCard("Tasks/a.md");
		const second = createCard("Tasks/b.md");
		cards.append(first, second);

		updateKanbanDropMarker(cards, [first, second], 2);

		expect(first.classList.contains("kanban-view__card-wrapper--drop-marker")).toBe(false);
		expect(second.classList.contains("kanban-view__card-wrapper--drop-marker")).toBe(false);
		expect(cards.classList.contains("kanban-view__cards--drop-marker-end")).toBe(true);
	});

	it("clears Kanban drop marker classes from a drag root", () => {
		const cards = document.createElement("div");
		const first = createCard("Tasks/a.md");
		cards.classList.add("kanban-view__cards--drop-marker-end");
		first.classList.add("kanban-view__card-wrapper--drop-marker");
		cards.appendChild(first);

		clearKanbanDropMarkers(cards);

		expect(first.classList.contains("kanban-view__card-wrapper--drop-marker")).toBe(false);
		expect(cards.classList.contains("kanban-view__cards--drop-marker-end")).toBe(false);
	});

	it("appends dragged cards into an empty target container for optimistic cross-column drops", () => {
		const source = document.createElement("div");
		const target = document.createElement("div");
		const dragged = createCard("Tasks/a.md");
		dragged.classList.add("kanban-view__card--dragging", "tn-static-height-0-7a31cef0");
		dragged.style.height = "0px";
		source.appendChild(dragged);
		const currentTaskElements = new Map([["Tasks/a.md", dragged]]);
		const removeEmptyCellHint = jest.fn();

		const result = performKanbanOptimisticReorder({
			draggedPaths: ["Tasks/a.md"],
			dropTarget: undefined,
			targetContainer: target,
			currentTaskElements,
			removeEmptyCellHint,
		});

		expect(result).toBe(true);
		expect(taskPaths(target)).toEqual(["Tasks/a.md"]);
		expect(removeEmptyCellHint).toHaveBeenCalledWith(target);
		expect(dragged.classList.contains("kanban-view__card--dragging")).toBe(false);
		expect(dragged.classList.contains("tn-static-height-0-7a31cef0")).toBe(false);
		expect(dragged.getAttribute("style")).toBeNull();
	});

	it("inserts dragged cards relative to a target card for optimistic in-column drops", () => {
		const container = document.createElement("div");
		const dragged = createCard("Tasks/a.md");
		const first = createCard("Tasks/b.md");
		const second = createCard("Tasks/c.md");
		container.append(first, dragged, second);
		const currentTaskElements = new Map([
			["Tasks/a.md", dragged],
			["Tasks/b.md", first],
			["Tasks/c.md", second],
		]);

		const result = performKanbanOptimisticReorder({
			draggedPaths: ["Tasks/a.md"],
			dropTarget: { taskPath: "Tasks/c.md", above: true },
			currentTaskElements,
		});

		expect(result).toBe(true);
		expect(taskPaths(container)).toEqual(["Tasks/b.md", "Tasks/a.md", "Tasks/c.md"]);
	});

	it("bails out when a cross-column target card is stale for the provided container", () => {
		const source = document.createElement("div");
		const target = document.createElement("div");
		const dragged = createCard("Tasks/a.md");
		const staleTarget = createCard("Tasks/b.md");
		source.append(dragged, staleTarget);
		const currentTaskElements = new Map([
			["Tasks/a.md", dragged],
			["Tasks/b.md", staleTarget],
		]);

		const result = performKanbanOptimisticReorder({
			draggedPaths: ["Tasks/a.md"],
			dropTarget: { taskPath: "Tasks/b.md", above: true },
			targetContainer: target,
			currentTaskElements,
		});

		expect(result).toBe(false);
		expect(taskPaths(source)).toEqual(["Tasks/a.md", "Tasks/b.md"]);
		expect(taskPaths(target)).toEqual([]);
	});

	it("plans no frontmatter write for same-column drops without sort order", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "open",
			sourceSwimlane: null,
			newGroupValue: "open",
			newSwimLaneValue: null,
			groupByPropertyId: "task.status",
			swimLanePropertyId: null,
			groupByTaskProp: "status",
			swimlaneTaskProp: null,
			isGroupByListProperty: false,
			isSwimlaneListProperty: false,
		});

		expect(plan.needsGroupUpdate).toBe(false);
		expect(plan.needsSwimlaneUpdate).toBe(false);
		expect(kanbanDropPlanNeedsWrite(plan, false)).toBe(false);
		expect(kanbanDropPlanNeedsWrite(plan, true)).toBe(true);
	});

	it("updates scalar group and swimlane properties through a single plan", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "open",
			sourceSwimlane: "low",
			newGroupValue: "done",
			newSwimLaneValue: "high",
			groupByPropertyId: "task.status",
			swimLanePropertyId: "task.priority",
			groupByTaskProp: "status",
			swimlaneTaskProp: "priority",
			isGroupByListProperty: false,
			isSwimlaneListProperty: false,
		});
		const frontmatter = { status: "open", priority: "low" };

		applyKanbanTaskDropFrontmatterPlan(frontmatter, plan, {
			coerceGroupValue: (_frontmatterKey, groupKey) => groupKey.toUpperCase(),
		});

		expect(frontmatter).toEqual({ status: "DONE", priority: "HIGH" });
		expect(plan.changedTaskProp).toBe("status");
		expect(plan.oldPropValue).toBe("open");
		expect(plan.newPropValue).toBe("done");
	});

	it("removes source and adds target for list-valued group properties", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "work",
			sourceSwimlane: null,
			newGroupValue: "home",
			newSwimLaneValue: null,
			groupByPropertyId: "task.projects",
			swimLanePropertyId: null,
			groupByTaskProp: "projects",
			swimlaneTaskProp: null,
			isGroupByListProperty: true,
			isSwimlaneListProperty: false,
		});
		const frontmatter = { projects: ["work", "archive"] };

		applyKanbanTaskDropFrontmatterPlan(frontmatter, plan, {
			coerceGroupValue: (_frontmatterKey, groupKey) => groupKey,
		});

		expect(frontmatter.projects).toEqual(["archive", "home"]);
	});

	it("removes source without adding None for list-valued swimlanes", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "open",
			sourceSwimlane: "blocked",
			newGroupValue: "open",
			newSwimLaneValue: "None",
			groupByPropertyId: "task.status",
			swimLanePropertyId: "note.contexts",
			groupByTaskProp: "status",
			swimlaneTaskProp: "contexts",
			isGroupByListProperty: false,
			isSwimlaneListProperty: true,
		});
		const frontmatter = { status: "open", contexts: ["blocked"] };

		applyKanbanTaskDropFrontmatterPlan(frontmatter, plan, {
			coerceGroupValue: (_frontmatterKey, groupKey) => groupKey,
		});

		expect(frontmatter).toEqual({ status: "open", contexts: [] });
		expect(plan.needsGroupUpdate).toBe(false);
		expect(plan.needsSwimlaneUpdate).toBe(true);
		expect(plan.changedTaskProp).toBe("contexts");
	});

	it("plans derived frontmatter writes for status column drops", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "open",
			sourceSwimlane: null,
			newGroupValue: "done",
			newSwimLaneValue: null,
			groupByPropertyId: "task.status",
			swimLanePropertyId: null,
			groupByTaskProp: "status",
			swimlaneTaskProp: null,
			isGroupByListProperty: false,
			isSwimlaneListProperty: false,
		});

		expect(
			planKanbanStatusDerivativeUpdate({
				plan,
				task: createTask({ recurrence: "FREQ=DAILY" }),
				dateModifiedField: "dateModified",
				dateModifiedValue: "2026-05-19T08:10:00+10:00",
			})
		).toEqual({
			statusValue: "done",
			isRecurring: true,
			dateModifiedField: "dateModified",
			dateModifiedValue: "2026-05-19T08:10:00+10:00",
		});
	});

	it("plans derived frontmatter writes for status swimlane drops", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "project-a",
			sourceSwimlane: "open",
			newGroupValue: "project-a",
			newSwimLaneValue: "done",
			groupByPropertyId: "task.projects",
			swimLanePropertyId: "task.status",
			groupByTaskProp: "projects",
			swimlaneTaskProp: "status",
			isGroupByListProperty: false,
			isSwimlaneListProperty: false,
		});

		expect(
			planKanbanStatusDerivativeUpdate({
				plan,
				task: createTask(),
				dateModifiedField: "dateModified",
				dateModifiedValue: "2026-05-19T08:10:00+10:00",
			})
		).toEqual({
			statusValue: "done",
			isRecurring: false,
			dateModifiedField: "dateModified",
			dateModifiedValue: "2026-05-19T08:10:00+10:00",
		});
	});

	it("skips status derivative planning when the moved property is not status", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "low",
			sourceSwimlane: null,
			newGroupValue: "high",
			newSwimLaneValue: null,
			groupByPropertyId: "task.priority",
			swimLanePropertyId: null,
			groupByTaskProp: "priority",
			swimlaneTaskProp: null,
			isGroupByListProperty: false,
			isSwimlaneListProperty: false,
		});

		expect(
			planKanbanStatusDerivativeUpdate({
				plan,
				task: createTask(),
				dateModifiedField: "dateModified",
				dateModifiedValue: "2026-05-19T08:10:00+10:00",
			})
		).toBeNull();
	});

	it("builds a post-write side-effect task snapshot for status changes", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "open",
			sourceSwimlane: null,
			newGroupValue: "done",
			newSwimLaneValue: null,
			groupByPropertyId: "task.status",
			swimLanePropertyId: null,
			groupByTaskProp: "status",
			swimlaneTaskProp: null,
			isGroupByListProperty: false,
			isSwimlaneListProperty: false,
		});
		const sideEffectPlan = planKanbanDropSideEffect({
			plan,
			originalTask: createTask({ completedDate: undefined }),
			dateModifiedValue: "2026-05-19T08:10:00+10:00",
			isCompletedStatus: (status) => status === "done",
		});

		expect(sideEffectPlan?.changedTaskProp).toBe("status");
		expect(sideEffectPlan?.oldPropValue).toBe("open");
		expect(sideEffectPlan?.newPropValue).toBe("done");
		expect(sideEffectPlan?.updatedTask.status).toBe("done");
		expect(sideEffectPlan?.updatedTask.dateModified).toBe("2026-05-19T08:10:00+10:00");
		expect(sideEffectPlan?.updatedTask.completedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("builds a post-write side-effect task snapshot without completion dates for recurring statuses", () => {
		const plan = planKanbanTaskDropUpdate({
			path: "Tasks/a.md",
			sourceColumn: "open",
			sourceSwimlane: null,
			newGroupValue: "done",
			newSwimLaneValue: null,
			groupByPropertyId: "task.status",
			swimLanePropertyId: null,
			groupByTaskProp: "status",
			swimlaneTaskProp: null,
			isGroupByListProperty: false,
			isSwimlaneListProperty: false,
		});
		const sideEffectPlan = planKanbanDropSideEffect({
			plan,
			originalTask: createTask({ recurrence: "FREQ=DAILY", completedDate: "2026-05-18" }),
			dateModifiedValue: "2026-05-19T08:10:00+10:00",
			isCompletedStatus: (status) => status === "done",
		});

		expect(sideEffectPlan?.updatedTask.status).toBe("done");
		expect(sideEffectPlan?.updatedTask.completedDate).toBe("2026-05-18");
	});
});
