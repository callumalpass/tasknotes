import { App, MockObsidian } from "../../__mocks__/obsidian";
import { TaskListView } from "../../../src/bases/TaskListView";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { TaskFactory } from "../../helpers/mock-factories";

jest.mock("obsidian");
jest.mock("tasknotes-nlp-core", () => ({
	NaturalLanguageParserCore: class {},
}), { virtual: true });

describe("TaskListView drag controls", () => {
	const createView = () => {
		const plugin = {
			app: new App(),
			fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
			settings: {
				fieldMapping: DEFAULT_FIELD_MAPPING,
			},
		};
		const containerEl = document.createElement("div");
		document.body.appendChild(containerEl);
		return new TaskListView({}, containerEl, plugin as any);
	};

	beforeEach(() => {
		MockObsidian.reset();
		document.body.innerHTML = "";
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("does not start a drag from no-drag task card controls", () => {
		const view = createView();
		const task = TaskFactory.createTask({ path: "tasks/drag-guard.md" });
		const card = document.createElement("div");
		const toggle = document.createElement("div");

		card.className = "task-card";
		card.setAttribute("draggable", "true");
		toggle.dataset.tnNoDrag = "true";
		toggle.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		card.appendChild(toggle);

		(view as any).setupCardDragHandlers(card, task, null);

		const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
		toggle.dispatchEvent(mouseDown);
		expect(card.getAttribute("draggable")).toBe("false");

		const dragStart = new Event("dragstart", { bubbles: true, cancelable: true }) as DragEvent;
		card.dispatchEvent(dragStart);

		expect(dragStart.defaultPrevented).toBe(true);
		expect((view as any).draggedTaskPath).toBeNull();
		expect(card.classList.contains("task-card--dragging")).toBe(false);
		expect(card.getAttribute("draggable")).toBe("true");
	});

	it("opens the preview slot after the hovered card when dropping below the last item in a group", () => {
		const view = createView();
		const itemsContainer = document.createElement("div");
		const lastCardInGroup = document.createElement("div");
		const nextGroupHeader = document.createElement("div");

		lastCardInGroup.className = "task-card";
		nextGroupHeader.className = "task-section task-group";

		itemsContainer.appendChild(lastCardInGroup);
		itemsContainer.appendChild(nextGroupHeader);
		(view as any).itemsContainer = itemsContainer;

		(view as any).updateDropSlotPreview({
			groupKey: "alpha",
			insertionIndex: 1,
			element: lastCardInGroup,
			position: "after",
		});

		expect(lastCardInGroup.classList.contains("task-list-view__drop-slot-after")).toBe(true);
		expect(nextGroupHeader.classList.contains("task-list-view__drop-slot-before")).toBe(false);
	});

	it("resolves the closest insertion slot at grouped boundaries", () => {
		const view = createView();
		const itemsContainer = document.createElement("div");
		const firstCard = document.createElement("div");
		const groupHeader = document.createElement("div");
		const secondCard = document.createElement("div");

		firstCard.className = "task-card";
		firstCard.dataset.taskPath = "tasks/first.md";
		secondCard.className = "task-card";
		secondCard.dataset.taskPath = "tasks/second.md";
		groupHeader.className = "task-section task-group";
		itemsContainer.getBoundingClientRect = () => ({
			top: 0,
			bottom: 200,
			height: 200,
		} as DOMRect);

		firstCard.getBoundingClientRect = () => ({
			top: 0,
			bottom: 40,
			height: 40,
		} as DOMRect);
		secondCard.getBoundingClientRect = () => ({
			top: 120,
			bottom: 160,
			height: 40,
		} as DOMRect);

		itemsContainer.appendChild(firstCard);
		itemsContainer.appendChild(groupHeader);
		itemsContainer.appendChild(secondCard);
		(view as any).itemsContainer = itemsContainer;
		(view as any).taskGroupKeys.set("tasks/first.md", "alpha");
		(view as any).taskGroupKeys.set("tasks/second.md", "beta");

		expect((view as any).resolveClosestInsertionSlot(70)).toMatchObject({
			groupKey: "alpha",
			segmentIndex: 0,
			insertionIndex: 1,
			element: firstCard,
			position: "after",
		});
		expect((view as any).resolveClosestInsertionSlot(105)).toMatchObject({
			groupKey: "beta",
			segmentIndex: 1,
			insertionIndex: 0,
			element: secondCard,
			position: "before",
		});
	});

	it("ignores nested relationship cards when resolving an insertion slot", () => {
		const view = createView();
		const itemsContainer = document.createElement("div");
		const firstCard = document.createElement("div");
		const nestedSubtask = document.createElement("div");
		const secondCard = document.createElement("div");
		const subtasksContainer = document.createElement("div");

		firstCard.className = "task-card";
		firstCard.dataset.taskPath = "tasks/first.md";
		nestedSubtask.className = "task-card task-card--subtask";
		nestedSubtask.dataset.taskPath = "tasks/nested-subtask.md";
		secondCard.className = "task-card";
		secondCard.dataset.taskPath = "tasks/second.md";
		subtasksContainer.className = "task-card__subtasks";
		itemsContainer.getBoundingClientRect = () => ({
			top: 0,
			bottom: 220,
			height: 220,
		} as DOMRect);

		firstCard.getBoundingClientRect = () => ({
			top: 0,
			bottom: 40,
			height: 40,
		} as DOMRect);
		nestedSubtask.getBoundingClientRect = () => ({
			top: 50,
			bottom: 90,
			height: 40,
		} as DOMRect);
		secondCard.getBoundingClientRect = () => ({
			top: 120,
			bottom: 160,
			height: 40,
		} as DOMRect);

		subtasksContainer.appendChild(nestedSubtask);
		firstCard.appendChild(subtasksContainer);
		itemsContainer.appendChild(firstCard);
		itemsContainer.appendChild(secondCard);
		(view as any).itemsContainer = itemsContainer;

		expect((view as any).resolveClosestInsertionSlot(70)).toMatchObject({
			groupKey: null,
			segmentIndex: 0,
			insertionIndex: 1,
			element: secondCard,
			position: "before",
		});
	});

	it("keeps using the captured insertion boundaries after the preview shifts live card positions", () => {
		const view = createView();
		const itemsContainer = document.createElement("div");
		const firstCard = document.createElement("div");
		const secondCard = document.createElement("div");
		const thirdCard = document.createElement("div");

		firstCard.className = "task-card";
		firstCard.dataset.taskPath = "tasks/first.md";
		secondCard.className = "task-card";
		secondCard.dataset.taskPath = "tasks/second.md";
		thirdCard.className = "task-card";
		thirdCard.dataset.taskPath = "tasks/third.md";
		itemsContainer.getBoundingClientRect = () => ({
			top: 0,
			bottom: 260,
			height: 260,
		} as DOMRect);

		firstCard.getBoundingClientRect = () => ({
			top: 0,
			bottom: 40,
			height: 40,
		} as DOMRect);
		secondCard.getBoundingClientRect = () => ({
			top: 50,
			bottom: 90,
			height: 40,
		} as DOMRect);
		thirdCard.getBoundingClientRect = () => ({
			top: 100,
			bottom: 140,
			height: 40,
		} as DOMRect);

		itemsContainer.appendChild(firstCard);
		itemsContainer.appendChild(secondCard);
		itemsContainer.appendChild(thirdCard);
		(view as any).itemsContainer = itemsContainer;
		(view as any).captureDropBaseline();

		secondCard.getBoundingClientRect = () => ({
			top: 110,
			bottom: 150,
			height: 40,
		} as DOMRect);
		thirdCard.getBoundingClientRect = () => ({
			top: 160,
			bottom: 200,
			height: 40,
		} as DOMRect);

		expect((view as any).resolveClosestInsertionSlot(150)).toMatchObject({
			groupKey: null,
			segmentIndex: 0,
			insertionIndex: 3,
			element: thirdCard,
			position: "after",
		});
	});

	it("reconstructs a drop target from the current insertion slot", () => {
		const view = createView();
		const itemsContainer = document.createElement("div");
		const firstCard = document.createElement("div");
		const secondCard = document.createElement("div");

		firstCard.className = "task-card";
		firstCard.dataset.taskPath = "tasks/first.md";
		secondCard.className = "task-card";
		secondCard.dataset.taskPath = "tasks/second.md";
		itemsContainer.getBoundingClientRect = () => ({
			top: 0,
			bottom: 120,
			height: 120,
		} as DOMRect);
		firstCard.getBoundingClientRect = () => ({
			top: 0,
			bottom: 40,
			height: 40,
		} as DOMRect);
		secondCard.getBoundingClientRect = () => ({
			top: 50,
			bottom: 90,
			height: 40,
		} as DOMRect);

		itemsContainer.appendChild(firstCard);
		itemsContainer.appendChild(secondCard);
		(view as any).itemsContainer = itemsContainer;
		(view as any).captureDropBaseline();

		expect((view as any).reconstructDropTargetFromInsertionSlot(0, 0)).toEqual({
			taskPath: "tasks/first.md",
			above: true,
		});
		expect((view as any).reconstructDropTargetFromInsertionSlot(0, 2)).toEqual({
			taskPath: "tasks/second.md",
			above: false,
		});
	});

	it("flushes the latest dragover insertion slot instead of recomputing from the drop event coordinates", () => {
		const view = createView();
		const updateResolvedInsertionSlot = jest
			.spyOn(view as any, "updateResolvedInsertionSlot")
			.mockReturnValue(true);
		const cancelAnimationFrameSpy = jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

		(view as any).dragOverRafId = 42;
		(view as any).pendingDragClientY = 135;
		(view as any).currentInsertionGroupKey = "alpha";
		(view as any).currentInsertionSegmentIndex = 1;
		(view as any).currentInsertionIndex = 2;

		expect((view as any).flushPendingInsertionSlot(400)).toBe(true);
		expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
		expect(updateResolvedInsertionSlot).toHaveBeenCalledWith(135);
		expect((view as any).dragOverRafId).toBe(0);

		cancelAnimationFrameSpy.mockRestore();
		updateResolvedInsertionSlot.mockRestore();
	});

	it("keeps repeated group keys confined to their visible segment when resolving a slot", () => {
		const view = createView();
		const itemsContainer = document.createElement("div");
		const alphaTop = document.createElement("div");
		const betaMiddle = document.createElement("div");
		const alphaBottom = document.createElement("div");

		alphaTop.className = "task-card";
		alphaTop.dataset.taskPath = "tasks/alpha-top.md";
		betaMiddle.className = "task-card";
		betaMiddle.dataset.taskPath = "tasks/beta-middle.md";
		alphaBottom.className = "task-card";
		alphaBottom.dataset.taskPath = "tasks/alpha-bottom.md";
		itemsContainer.getBoundingClientRect = () => ({
			top: 0,
			bottom: 700,
			height: 700,
		} as DOMRect);

		alphaTop.getBoundingClientRect = () => ({
			top: 0,
			bottom: 40,
			height: 40,
		} as DOMRect);
		betaMiddle.getBoundingClientRect = () => ({
			top: 260,
			bottom: 300,
			height: 40,
		} as DOMRect);
		alphaBottom.getBoundingClientRect = () => ({
			top: 560,
			bottom: 600,
			height: 40,
		} as DOMRect);

		itemsContainer.appendChild(alphaTop);
		itemsContainer.appendChild(betaMiddle);
		itemsContainer.appendChild(alphaBottom);
		(view as any).itemsContainer = itemsContainer;
		(view as any).taskGroupKeys.set("tasks/alpha-top.md", "alpha");
		(view as any).taskGroupKeys.set("tasks/beta-middle.md", "beta");
		(view as any).taskGroupKeys.set("tasks/alpha-bottom.md", "alpha");

		expect((view as any).resolveClosestInsertionSlot(360)).toMatchObject({
			groupKey: "beta",
			segmentIndex: 1,
			insertionIndex: 1,
			element: betaMiddle,
			position: "after",
		});

		expect((view as any).resolveClosestInsertionSlot(520)).toMatchObject({
			groupKey: "alpha",
			segmentIndex: 2,
			insertionIndex: 0,
			element: alphaBottom,
			position: "before",
		});
	});

	it("uses cached sort scope paths rather than the drag baseline when computing visible scope", () => {
		const view = createView();
		const itemsContainer = document.createElement("div");
		const firstCard = document.createElement("div");
		const secondCard = document.createElement("div");

		firstCard.className = "task-card";
		firstCard.dataset.taskPath = "tasks/first.md";
		secondCard.className = "task-card";
		secondCard.dataset.taskPath = "tasks/second.md";
		itemsContainer.getBoundingClientRect = () => ({
			top: 0,
			bottom: 120,
			height: 120,
		} as DOMRect);
		firstCard.getBoundingClientRect = () => ({
			top: 0,
			bottom: 40,
			height: 40,
		} as DOMRect);
		secondCard.getBoundingClientRect = () => ({
			top: 50,
			bottom: 90,
			height: 40,
		} as DOMRect);

		itemsContainer.appendChild(firstCard);
		itemsContainer.appendChild(secondCard);
		(view as any).itemsContainer = itemsContainer;
		(view as any).taskGroupKeys.set("tasks/first.md", "alpha");
		(view as any).taskGroupKeys.set("tasks/second.md", "alpha");
		(view as any).sortScopeTaskPaths.set("alpha", ["tasks/stale.md"]);
		(view as any).captureDropBaseline();

		expect((view as any).getVisibleSortScopePathsForDrag("alpha")).toEqual(["tasks/stale.md"]);
	});
});
