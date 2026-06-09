import { App, MockObsidian } from "../../helpers/obsidian-runtime";
import { TaskListView } from "../../../src/bases/TaskListView";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { TaskFactory } from "../../helpers/mock-factories";
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
		document.body.className = "";
		document.body.innerHTML = "";
	});

	afterEach(() => {
		document.body.className = "";
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

	it("starts mobile list reordering only from the dedicated drag handle", () => {
		document.body.classList.add("is-mobile");
		const view = createView();
		const task = TaskFactory.createTask({ path: "tasks/mobile-drag.md" });
		const card = document.createElement("div");
		const mainRow = document.createElement("div");

		card.className = "task-card";
		card.setAttribute("draggable", "true");
		mainRow.className = "task-card__main-row";
		card.appendChild(mainRow);

		(view as any).setupCardDragHandlers(card, task, null);

		const handle = card.querySelector("[data-tn-drag-handle='true']") as HTMLElement;
		expect(handle).toBeTruthy();
		expect(handle.classList.contains("task-card__drag-handle")).toBe(true);
		expect(handle.getAttribute("draggable")).toBe("true");
		expect(handle.getAttribute("aria-label")).toBe("Drag to reorder");
		expect(card.getAttribute("draggable")).toBe("false");
		expect(card.classList.contains("task-card--drag-handle-only")).toBe(true);

		let cardClickCount = 0;
		card.addEventListener("click", () => {
			cardClickCount++;
		});
		handle.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(cardClickCount).toBe(0);

		const blockedDragStart = new Event("dragstart", {
			bubbles: true,
			cancelable: true,
		}) as DragEvent;
		card.dispatchEvent(blockedDragStart);

		expect(blockedDragStart.defaultPrevented).toBe(true);
		expect((view as any).draggedTaskPath).toBeNull();

		const originalRequestAnimationFrame = window.requestAnimationFrame;
		window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		}) as typeof window.requestAnimationFrame;

		try {
			const handleDragStart = new Event("dragstart", {
				bubbles: true,
				cancelable: true,
			}) as DragEvent;
			handle.dispatchEvent(handleDragStart);

			expect(handleDragStart.defaultPrevented).toBe(false);
			expect((view as any).draggedTaskPath).toBe("tasks/mobile-drag.md");
			expect(card.classList.contains("task-card--dragging")).toBe(true);
		} finally {
			window.requestAnimationFrame = originalRequestAnimationFrame;
		}
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

	it("changes the card render signature when visible Bases properties change", () => {
		const view = createView();
		const targetDate = new Date(Date.UTC(2026, 4, 18));
		const initialSignature = (view as any).buildCardRenderSignature(["status"], {
			targetDate,
			propertyLabels: { status: "Status" },
		});
		const updatedSignature = (view as any).buildCardRenderSignature(
			["status", "sort_order"],
			{
				targetDate,
				propertyLabels: { status: "Status", sort_order: "sort_order" },
			}
		);

		expect(updatedSignature).not.toBe(initialSignature);
	});

	it("recreates the virtual renderer when visible Bases properties change", () => {
		const view = createView();
		const targetDate = new Date(Date.UTC(2026, 4, 18));
		const destroy = jest.fn();
		const initialSignature = (view as any).buildCardRenderSignature(["status"], {
			targetDate,
			propertyLabels: { status: "Status" },
		});
		const updatedSignature = (view as any).buildCardRenderSignature(
			["status", "sort_order"],
			{
				targetDate,
				propertyLabels: { status: "Status", sort_order: "sort_order" },
			}
		);

		(view as any).virtualScroller = { destroy };
		(view as any).lastCardRenderSignature = initialSignature;

		(view as any).resetVirtualScrollerIfCardRenderChanged(updatedSignature);

		expect(destroy).toHaveBeenCalledTimes(1);
		expect((view as any).virtualScroller).toBeNull();
	});

	it("optimistically reorders virtual task items after a sort-order write", () => {
		const view = createView();
		const taskA = TaskFactory.createTask({ path: "tasks/a.md", sortOrder: "0|hzzzzz:" } as any);
		const taskB = TaskFactory.createTask({ path: "tasks/b.md", sortOrder: "0|i0000f:" } as any);
		const taskC = TaskFactory.createTask({ path: "tasks/c.md", sortOrder: "0|i0000n:" } as any);
		const updateItems = jest.fn();

		(view as any).virtualScroller = { updateItems };
		(view as any).lastVirtualItems = [
			{
				type: "primary-header",
				groupKey: "todo",
				groupTitle: "Todo",
				taskCount: 3,
				groupEntries: [],
				isCollapsed: false,
			},
			{ type: "task", task: taskA, groupKey: "todo" },
			{ type: "task", task: taskB, groupKey: "todo" },
			{ type: "task", task: taskC, groupKey: "todo" },
		];
		(view as any).taskInfoCache.set(taskA.path, taskA);
		(view as any).taskInfoCache.set(taskB.path, taskB);
		(view as any).taskInfoCache.set(taskC.path, taskC);

		const applied = (view as any).applyOptimisticSortOrderResult(
			"tasks/c.md",
			"tasks/a.md",
			false,
			"todo",
			"todo",
			{
				sortOrder: "tnmzzzzzzzzz",
				additionalWrites: [
					{ path: "tasks/a.md", sortOrder: "tndgmzzzzzzz" },
					{ path: "tasks/b.md", sortOrder: "tnwtmzzzzzzt" },
				],
				reason: "rebalance",
			}
		);

		expect(applied).toBe(true);
		expect(updateItems).toHaveBeenCalledTimes(1);
		const updatedItems = updateItems.mock.calls[0][0] as any[];
		expect(updatedItems.map((item) => item.task?.path ?? item.groupKey)).toEqual([
			"todo",
			"tasks/a.md",
			"tasks/c.md",
			"tasks/b.md",
		]);
		expect(taskA.sortOrder).toBe("tndgmzzzzzzz");
		expect(taskB.sortOrder).toBe("tnwtmzzzzzzt");
		expect(taskC.sortOrder).toBe("tnmzzzzzzzzz");
		expect((view as any).getVisibleSortScopePaths("todo")).toEqual([
			"tasks/a.md",
			"tasks/c.md",
			"tasks/b.md",
		]);
	});

	it("changes the task render signature when sort order changes", () => {
		const view = createView();
		const task = TaskFactory.createTask({
			path: "tasks/sort-order.md",
			sortOrder: "0|hzzzzz:",
		} as any);

		expect((view as any).buildTaskSignature({ ...task, sortOrder: "0|i00000:" })).not.toBe(
			(view as any).buildTaskSignature(task)
		);
	});

	it("resolves the final insertion slot from the drop event coordinate", () => {
		const view = createView();
		const updateResolvedInsertionSlot = jest
			.spyOn(view as any, "updateResolvedInsertionSlot")
			.mockReturnValue(true);
		const cancelAnimationFrameSpy = jest
			.spyOn(window, "cancelAnimationFrame")
			.mockImplementation(() => {});

		(view as any).dragOverRafId = 42;
		(view as any).pendingDragClientY = 135;
		(view as any).currentInsertionGroupKey = "alpha";
		(view as any).currentInsertionSegmentIndex = 1;
		(view as any).currentInsertionIndex = 2;

		expect((view as any).flushPendingInsertionSlot(400)).toBe(true);
		expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
		expect(updateResolvedInsertionSlot).toHaveBeenCalledWith(400);
		expect((view as any).dragOverRafId).toBe(0);
		expect((view as any).pendingDragClientY).toBeNull();

		cancelAnimationFrameSpy.mockRestore();
		updateResolvedInsertionSlot.mockRestore();
	});

	it("uses the drop event coordinates after the queued dragover has already rendered", () => {
		const view = createView();
		const updateResolvedInsertionSlot = jest
			.spyOn(view as any, "updateResolvedInsertionSlot")
			.mockReturnValue(true);

		(view as any).dragOverRafId = 0;
		(view as any).pendingDragClientY = 135;

		expect((view as any).flushPendingInsertionSlot(400)).toBe(true);
		expect(updateResolvedInsertionSlot).toHaveBeenCalledWith(400);
		expect((view as any).pendingDragClientY).toBeNull();

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
