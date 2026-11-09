import { observeTranslation as mockObserveTranslation, englishText as mockEnglishText, conceptDescriptor as mockConceptDescriptor } from "../../helpers/real-i18n";
import { App, MockObsidian } from "../../helpers/obsidian-runtime";
import { TaskListView } from "../../../src/bases/TaskListView";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { TaskFactory } from "../../helpers/mock-factories";
import * as basesHelpers from "../../../src/bases/helpers";

jest.mock("tasknotes-nlp-core", () => ({
	NaturalLanguageParserCore: class {},
}), { virtual: true });

describe("TaskListView drag controls", () => {
	const createView = () => {
		const plugin = {
			app: new App(),
			fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
			i18n: {
				translate: mockObserveTranslation(),
			},
			statusManager: { getAllStatuses: () => [] },
			priorityManager: { getAllPriorities: () => [] },
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

	it("moves a row optimistically and restores its exact sibling on failure", () => {
		const view = createView() as any;
		view.itemsContainer = document.body.createDiv();
		const source = view.itemsContainer.createDiv({ cls: "task-list-group" });
		const sourceHeader = source.createDiv({ cls: "task-group" });
		const destination = view.itemsContainer.createDiv({ cls: "task-list-group" });
		const destinationHeader = destination.createDiv({ cls: "task-group" });
		const card = source.createDiv({ cls: "task-card", attr: { "data-task-path": "a.md" } });
		const next = source.createDiv({ cls: "task-card", attr: { "data-task-path": "b.md" } });
		view.elementDestinations.set(sourceHeader, { groupKey: "open" });
		view.elementDestinations.set(destinationHeader, { groupKey: "done" });
		view.currentTaskElements.set("a.md", card);
		view.getVisibleTaskPaths = () => ["a.md", "b.md"];
		const rollback = view.stageTaskMovement("a.md", { groupKey: "open" }, { groupKey: "done" });
		expect(card.parentElement).toBe(destination);
		rollback();
		expect(card.parentElement).toBe(source);
		expect(card.nextSibling).toBe(next);
	});

	it("moves virtual rows and group counts without changing the task's persisted fields", () => {
		const view = createView() as any;
		const task = TaskFactory.createTask({ path: "a.md", status: "open" });
		const before = [
			{ type: "primary-header", groupKey: "open", taskCount: 1, isCollapsed: false },
			{ type: "task", groupKey: "open", task },
			{ type: "primary-header", groupKey: "done", taskCount: 0, isCollapsed: false },
		];
		view.lastVirtualItems = before;
		view.virtualScroller = { updateItems: jest.fn(), invalidateItems: jest.fn() };
		view.getVisibleTaskPaths = () => ["a.md"];
		const rollback = view.stageTaskMovement("a.md", { groupKey: "open" }, { groupKey: "done" });
		expect(view.lastVirtualItems.map((item: any) => item.type === "task" ? item.groupKey : item.taskCount)).toEqual([0, 1, "done"]);
		expect(task.status).toBe("open");
		rollback();
		expect(view.lastVirtualItems).toBe(before);
	});

	it("does not reuse a drag confirmation for a later menu reorder", async () => {
		const view = createView() as any;
		view.reorderConfirmed = true;
		view.shouldEnableManualReordering = jest.fn(() => true);
		view.getVisibleSortScopePaths = jest.fn(() => ["tasks/first.md", "tasks/second.md"]);
		view.filterMovementSortScope = jest.fn((paths) => paths);
		view.handleSortOrderDrop = jest.fn(async () => {
			expect(view.reorderConfirmed).toBe(false);
		});
		view.debouncedRefresh = jest.fn();
		let action: (() => void) | undefined;
		const item = {
			setTitle: jest.fn().mockReturnThis(),
			setIcon: jest.fn().mockReturnThis(),
			onClick: jest.fn((callback) => { action = callback; }),
		};
		view.addReorderMenuItems({ addItem: (configure: (item: unknown) => void) => configure(item) }, "tasks/second.md", { groupKey: "open" });
		action!();
		await Promise.resolve();
		expect(view.handleSortOrderDrop).toHaveBeenCalledTimes(1);
	});

	it("stages into the original Bases sort order rather than the grouped DOM order", () => {
		const view = createView() as any;
		const items = document.createElement("div");
		const source = items.createDiv();
		const destination = items.createDiv();
		const header = destination.createDiv({ cls: "task-group" });
		const moving = source.createDiv({ cls: "task-card", attr: { "data-task-path": "b.md" } });
		for (const path of ["a.md", "c.md"]) destination.createDiv({ cls: "task-card", attr: { "data-task-path": path } });
		view.itemsContainer = items;
		view.currentTaskElements.set("b.md", moving);
		view.elementDestinations.set(header, { groupKey: "done" });
		view.currentVisibleTaskOrder = new Map([["a.md", 0], ["b.md", 1], ["c.md", 2]]);
		const rollback = view.stageTaskMovement("b.md", { groupKey: "open" }, { groupKey: "done" });
		expect([...destination.querySelectorAll(".task-card")].map((card: HTMLElement) => card.dataset.taskPath)).toEqual(["a.md", "b.md", "c.md"]);
		rollback();
		expect(moving.parentElement).toBe(source);
	});

	it("stages a virtual move into an empty destination and refreshes sticky header indices", () => {
		const view = createView() as any;
		const task = TaskFactory.createTask({ path: "a.md", status: "open" });
		const previous = [{ type: "primary-header", groupKey: "open", taskCount: 1 }, { type: "task", groupKey: "open", task }];
		view.lastVirtualItems = previous;
		view.virtualScroller = { updateItems: jest.fn(), invalidateItems: jest.fn() };
		view.movementDestinationLabel = () => "Done";
		const rollback = view.stageTaskMovement("a.md", { groupKey: "open" }, { groupKey: "done" });
		expect(view.virtualStickyHeaderIndices).toEqual([0, 1]);
		expect(view.lastVirtualItems[2]).toMatchObject({ type: "task", groupKey: "done", task });
		expect(task.status).toBe("open");
		rollback();
		expect(view.lastVirtualItems).toBe(previous);
		expect(view.virtualStickyHeaderIndices).toEqual([0]);
	});

	it("defers task refreshes for the entire pending movement write", async () => {
		const view = createView() as any;
		view.pendingMovementCount = 1;
		const task = TaskFactory.createTask({ path: "a.md", status: "open" });
		await view.handleTaskUpdate(task);
		expect(view.pendingRender).toBe(true);
		expect(view.taskInfoCache.has(task.path)).toBe(false);
	});

	it.each(["pending-write", "active-drag"])("defers an already-started grouped refresh during %s", async (state) => {
		const view = createView() as any;
		view.data = { data: [] };
		view.dataAdapter.extractDataItems = jest.fn(() => []);
		let resolveIdentification!: (tasks: never[]) => void;
		const identification = new Promise<never[]>(resolve => { resolveIdentification = resolve; });
		const identify = jest.spyOn(basesHelpers, "identifyTaskNotesFromBasesData").mockReturnValueOnce(identification);
		const applyFilter = jest.spyOn(view, "applySearchFilter").mockImplementation(() => {
			throw new Error("Grouped refresh resumed during a movement");
		});
		try {
			const refreshing = view.refreshGroupedView();
			expect(identify).toHaveBeenCalledTimes(1);
			if (state === "pending-write") view.pendingMovementCount = 1;
			else view.draggedTaskPath = "a.md";
			resolveIdentification([]);
			await refreshing;
			expect(view.pendingRender).toBe(true);
			expect(applyFilter).not.toHaveBeenCalled();
		} finally {
			identify.mockRestore();
			applyFilter.mockRestore();
		}
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

	it("keeps a desktop-created handle in the action row when switching to mobile", () => {
		const view = createView();
		const task = TaskFactory.createTask({ path: "tasks/responsive-drag.md" });
		const card = document.createElement("div");
		card.className = "task-card";
		const mainRow = card.createDiv({ cls: "task-card__main-row" });
		(view as any).setupCardDragHandlers(card, task, null);
		const handle = card.querySelector<HTMLElement>("[data-tn-drag-handle='true']")!;
		expect(handle.parentElement).toBe(mainRow);
		document.body.classList.add("is-mobile");
		mainRow.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
		expect(card.getAttribute("draggable")).toBe("false");
		handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
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
		expect(handle.parentElement).toBe(mainRow);
		expect(handle.getAttribute("draggable")).toBe("true");
		expect(handle.getAttribute("aria-label")).toBe("Move task");
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

	it("drags the visible selection together and clears every source on cancellation", async () => {
		const view = createView();
		const state = view as any;
		const items = document.createElement("div");
		const paths = ["tasks/first.md", "tasks/second.md", "tasks/third.md"];
		for (const path of paths) {
			const card = items.createDiv({ cls: "task-card task-card--reorderable" });
			card.dataset.taskPath = path;
			card.createDiv({ cls: "task-card__main-row" }).createDiv({ cls: "task-card__drag-handle" });
		}
		state.itemsContainer = items;
		state.rootElement = items;
		state.currentVisibleTaskPaths = paths;
		state.plugin.taskSelectionService = { isSelected: (path: string) => paths.slice(0, 2).includes(path) };
		state.showEmptyMovementDestinations = jest.fn();
		state.captureDropBaseline = jest.fn();
		state.debouncedRefresh = jest.fn();
		state.beginTaskMovement(items.firstElementChild, TaskFactory.createTask({ path: paths[0] }), "open", { clientX: 100, clientY: 100 });
		expect(state.draggedTaskPaths).toEqual(paths.slice(0, 2));
		expect(items.querySelectorAll(".task-list-view__drag-source")).toHaveLength(2);
		const preview = document.body.querySelector<HTMLElement>(".kanban-view__floating-drag-preview");
		expect(preview?.dataset.dragCount).toBe("2");
		expect(preview?.querySelector(".task-card__main-row")).not.toBeNull();
		expect(preview?.querySelector(".task-card")?.className).toBe("task-card");
		expect(preview?.querySelector(".task-card__drag-handle")).toBeNull();
		expect(items.querySelectorAll(".task-card__drag-handle")).toHaveLength(3);
		expect(preview?.querySelector("[data-task-path]")).toBeNull();
		expect(state.getVisibleDropCards().map((card: HTMLElement) => card.dataset.taskPath)).toEqual([paths[2]]);
		await state.handleTaskUpdate(TaskFactory.createTask({ path: paths[0], title: "Changed during drag" }));
		expect(state.pendingRender).toBe(true);
		expect(items.querySelectorAll(".task-list-view__drag-source")).toHaveLength(2);
		state.cancelTaskMovement();
		expect(state.debouncedRefresh).toHaveBeenCalled();
		expect(items.querySelectorAll(".task-list-view__drag-source, .task-list-view__touch-ghost")).toHaveLength(0);
		expect(document.body.querySelector(".kanban-view__floating-drag-preview")).toBeNull();
		expect(document.body.classList.contains("tn-drag-active")).toBe(false);
		state.beginTaskMovement(items.children[2], TaskFactory.createTask({ path: paths[2] }), "open", { clientX: 100, clientY: 100 });
		expect(state.draggedTaskPaths).toEqual([paths[2]]);
		state.cancelTaskMovement();
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

	it("builds task signatures for link-valued formulas without serializing live Bases values (#2399)", () => {
		const view = createView();
		class LinkValue {
			app: Record<string, unknown> = {};
			constructor(private readonly target: string) {
				this.app.app = this.app;
			}
			renderTo() {}
			toString() {
				return this.target;
			}
		}
		const withBacklinks = (targets: string[]) =>
			TaskFactory.createTask({
				path: "tasks/backlinks.md",
				basesData: {
					getValue: (propertyId: string) =>
						propertyId === "formula.backlinks"
							? targets.map((target) => new LinkValue(target))
							: null,
				},
			} as any);

		const signature = (view as any).buildTaskSignature(withBacklinks(["notes/a.md"]), [
			"formula.backlinks",
		]);
		expect(typeof signature).toBe("string");
		expect(
			(view as any).buildTaskSignature(withBacklinks(["notes/a.md", "notes/b.md"]), [
				"formula.backlinks",
			])
		).not.toBe(signature);
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
