import {
	clearBasesSelectionVisuals,
	getVisibleTaskPathsFromBasesRoot,
	handleBasesSelectionClick,
	handleBasesSelectionKeyDown,
	setBasesSelectionModeUi,
	updateBasesSelectionIndicator,
	updateBasesSelectionVisuals,
	type BasesSelectionClickState,
	type BasesSelectionKeyboardState,
} from "../../../src/bases/basesSelectionUi";

function createTaskCard(path: string): HTMLElement {
	const card = document.createElement("div");
	card.className = "task-card";
	card.dataset.taskPath = path;
	return card;
}

function createKanbanWrapper(path: string): HTMLElement {
	const wrapper = document.createElement("div");
	wrapper.className = "kanban-view__card-wrapper";
	wrapper.dataset.taskPath = path;
	return wrapper;
}

function createSelectionService(
	options: {
		active?: boolean;
		selected?: string[];
		primaryPath?: string | null;
	} = {}
): BasesSelectionClickState & BasesSelectionKeyboardState {
	let active = options.active ?? false;
	const selected = new Set(options.selected ?? []);

	return {
		isSelectionModeActive: jest.fn(() => active),
		enterSelectionMode: jest.fn(() => {
			active = true;
		}),
		exitSelectionMode: jest.fn(() => {
			active = false;
		}),
		toggleSelection: jest.fn((path: string) => {
			if (selected.has(path)) {
				selected.delete(path);
			} else {
				selected.add(path);
			}
		}),
		selectRange: jest.fn(),
		selectAll: jest.fn(),
		selectAdjacentRange: jest.fn(),
		isSelected: jest.fn((path: string) => selected.has(path)),
		getPrimarySelectedPath: jest.fn(() => options.primaryPath ?? null),
	};
}

describe("basesSelectionUi", () => {
	it("sets selection mode state and clears stale selected classes when leaving mode", () => {
		const root = document.createElement("div");
		const card = createTaskCard("Tasks/a.md");
		card.classList.add("task-card--selected", "task-card--selected-primary");
		root.appendChild(card);

		setBasesSelectionModeUi(root, true);

		expect(root.classList.contains("tn-selection-mode")).toBe(true);
		expect(root.getAttribute("data-selection-mode")).toBe("true");

		setBasesSelectionModeUi(root, false);

		expect(root.classList.contains("tn-selection-mode")).toBe(false);
		expect(root.hasAttribute("data-selection-mode")).toBe(false);
		expect(card.classList.contains("task-card--selected")).toBe(false);
		expect(card.classList.contains("task-card--selected-primary")).toBe(false);
	});

	it("updates task-card and Kanban wrapper visual selection state", () => {
		const root = document.createElement("div");
		const firstCard = createTaskCard("Tasks/a.md");
		const secondCard = createTaskCard("Tasks/b.md");
		const wrapper = createKanbanWrapper("Tasks/b.md");
		root.append(firstCard, secondCard, wrapper);
		const selectionService = createSelectionService({
			selected: ["Tasks/a.md", "Tasks/b.md"],
			primaryPath: "Tasks/b.md",
		});

		updateBasesSelectionVisuals(root, selectionService);

		expect(firstCard.classList.contains("task-card--selected")).toBe(true);
		expect(firstCard.classList.contains("task-card--selected-primary")).toBe(false);
		expect(secondCard.classList.contains("task-card--selected")).toBe(true);
		expect(secondCard.classList.contains("task-card--selected-primary")).toBe(true);
		expect(wrapper.classList.contains("kanban-view__card-wrapper--selected")).toBe(true);
		expect(wrapper.classList.contains("kanban-view__card-wrapper--selected-primary")).toBe(true);
	});

	it("clears visual selection state from task cards and Kanban wrappers", () => {
		const root = document.createElement("div");
		const card = createTaskCard("Tasks/a.md");
		const wrapper = createKanbanWrapper("Tasks/a.md");
		card.classList.add("task-card--selected", "task-card--selected-primary");
		wrapper.classList.add(
			"kanban-view__card-wrapper--selected",
			"kanban-view__card-wrapper--selected-primary"
		);
		root.append(card, wrapper);

		clearBasesSelectionVisuals(root);

		expect(card.classList.contains("task-card--selected")).toBe(false);
		expect(card.classList.contains("task-card--selected-primary")).toBe(false);
		expect(wrapper.classList.contains("kanban-view__card-wrapper--selected")).toBe(false);
		expect(wrapper.classList.contains("kanban-view__card-wrapper--selected-primary")).toBe(false);
	});

	it("creates, updates, hides, and activates the selection indicator", () => {
		const root = document.createElement("div");
		const onClearSelection = jest.fn();

		const indicator = updateBasesSelectionIndicator({
			rootElement: root,
			indicatorEl: null,
			count: 2,
			onClearSelection,
		});

		expect(indicator).not.toBeNull();
		expect(indicator?.parentElement).toBe(root);
		expect(indicator?.className).toContain("tn-selection-indicator");
		expect(indicator?.getAttribute("role")).toBe("button");
		expect(indicator?.tabIndex).toBe(0);
		expect(indicator?.textContent).toBe("2 selected");
		expect(indicator?.getAttribute("aria-label")).toBe(
			"2 selected. Activate to clear selection."
		);
		expect(indicator?.classList.contains("tn-static-display-block-2a1b75c9")).toBe(true);

		indicator?.click();
		indicator?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

		expect(onClearSelection).toHaveBeenCalledTimes(2);

		const hiddenIndicator = updateBasesSelectionIndicator({
			rootElement: root,
			indicatorEl: indicator,
			count: 0,
			onClearSelection,
		});

		expect(hiddenIndicator).toBe(indicator);
		expect(indicator?.classList.contains("tn-static-display-none-6b99de8b")).toBe(true);
	});

	it("plans selection clicks without handling ordinary clicks", () => {
		const selectionService = createSelectionService();
		const updateSelectionVisuals = jest.fn();
		const getVisibleTaskPaths = jest.fn(() => ["Tasks/a.md", "Tasks/b.md"]);

		const handled = handleBasesSelectionClick({
			event: new MouseEvent("click"),
			taskPath: "Tasks/a.md",
			selectionService,
			getVisibleTaskPaths,
			updateSelectionVisuals,
		});

		expect(handled).toBe(false);
		expect(selectionService.toggleSelection).not.toHaveBeenCalled();
		expect(updateSelectionVisuals).not.toHaveBeenCalled();
		expect(getVisibleTaskPaths).not.toHaveBeenCalled();
	});

	it("handles range, modified, and active-mode selection clicks", () => {
		const inactiveService = createSelectionService();
		const activeService = createSelectionService({ active: true });
		const updateSelectionVisuals = jest.fn();
		const getVisibleTaskPaths = jest.fn(() => ["Tasks/a.md", "Tasks/b.md"]);

		expect(
			handleBasesSelectionClick({
				event: new MouseEvent("click", { shiftKey: true }),
				taskPath: "Tasks/b.md",
				selectionService: inactiveService,
				getVisibleTaskPaths,
				updateSelectionVisuals,
			})
		).toBe(true);
		expect(inactiveService.enterSelectionMode).toHaveBeenCalled();
		expect(inactiveService.selectRange).toHaveBeenCalledWith("Tasks/b.md", [
			"Tasks/a.md",
			"Tasks/b.md",
		]);

		expect(
			handleBasesSelectionClick({
				event: new MouseEvent("click", { ctrlKey: true }),
				taskPath: "Tasks/a.md",
				selectionService: inactiveService,
				getVisibleTaskPaths,
				updateSelectionVisuals,
			})
		).toBe(true);
		expect(inactiveService.toggleSelection).toHaveBeenCalledWith("Tasks/a.md");

		expect(
			handleBasesSelectionClick({
				event: new MouseEvent("click"),
				taskPath: "Tasks/b.md",
				selectionService: activeService,
				getVisibleTaskPaths,
				updateSelectionVisuals,
			})
		).toBe(true);
		expect(activeService.toggleSelection).toHaveBeenCalledWith("Tasks/b.md");
		expect(updateSelectionVisuals).toHaveBeenCalledTimes(3);
	});

	it("handles selection keyboard shortcuts only while selection mode is active", () => {
		const inactiveService = createSelectionService();
		const activeService = createSelectionService({ active: true });
		const updateSelectionModeUi = jest.fn();
		const updateSelectionVisuals = jest.fn();
		const getVisibleTaskPaths = jest.fn(() => ["Tasks/a.md", "Tasks/b.md"]);

		expect(
			handleBasesSelectionKeyDown({
				event: new KeyboardEvent("keydown", { key: "Escape" }),
				selectionService: inactiveService,
				getVisibleTaskPaths,
				updateSelectionModeUi,
				updateSelectionVisuals,
			})
		).toBe(false);

		expect(
			handleBasesSelectionKeyDown({
				event: new KeyboardEvent("keydown", { key: "Escape" }),
				selectionService: activeService,
				getVisibleTaskPaths,
				updateSelectionModeUi,
				updateSelectionVisuals,
			})
		).toBe(true);
		expect(activeService.exitSelectionMode).toHaveBeenCalledWith(true);
		expect(updateSelectionModeUi).toHaveBeenCalledWith(false);

		const selectAllService = createSelectionService({ active: true });
		const event = new KeyboardEvent("keydown", { key: "a", ctrlKey: true });

		expect(
			handleBasesSelectionKeyDown({
				event,
				selectionService: selectAllService,
				getVisibleTaskPaths,
				updateSelectionModeUi,
				updateSelectionVisuals,
			})
		).toBe(true);
		expect(selectAllService.selectAll).toHaveBeenCalledWith(["Tasks/a.md", "Tasks/b.md"]);
		expect(updateSelectionVisuals).toHaveBeenCalled();
	});

	it("extends active selection with Shift+arrow keys", () => {
		const activeService = createSelectionService({ active: true });
		const updateSelectionModeUi = jest.fn();
		const updateSelectionVisuals = jest.fn();
		const getVisibleTaskPaths = jest.fn(() => ["Tasks/a.md", "Tasks/b.md"]);
		const event = new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true });

		expect(
			handleBasesSelectionKeyDown({
				event,
				selectionService: activeService,
				getVisibleTaskPaths,
				updateSelectionModeUi,
				updateSelectionVisuals,
			})
		).toBe(true);

		expect(activeService.selectAdjacentRange).toHaveBeenCalledWith(1, [
			"Tasks/a.md",
			"Tasks/b.md",
		]);
		expect(updateSelectionVisuals).toHaveBeenCalled();
	});

	it("does not steal selection keyboard shortcuts from editable controls", () => {
		const activeService = createSelectionService({ active: true });
		const updateSelectionModeUi = jest.fn();
		const updateSelectionVisuals = jest.fn();
		const getVisibleTaskPaths = jest.fn(() => ["Tasks/a.md", "Tasks/b.md"]);
		const input = document.createElement("input");

		expect(
			handleBasesSelectionKeyDown({
				event: {
					key: "ArrowDown",
					shiftKey: true,
					ctrlKey: false,
					metaKey: false,
					target: input,
					preventDefault: jest.fn(),
				},
				selectionService: activeService,
				getVisibleTaskPaths,
				updateSelectionModeUi,
				updateSelectionVisuals,
			})
		).toBe(false);

		expect(activeService.selectAdjacentRange).not.toHaveBeenCalled();
		expect(getVisibleTaskPaths).not.toHaveBeenCalled();
		expect(updateSelectionVisuals).not.toHaveBeenCalled();
	});

	it("reads visible task paths from the shared Bases root", () => {
		const root = document.createElement("div");
		root.append(createTaskCard("Tasks/a.md"), createTaskCard("Tasks/b.md"));
		root.appendChild(document.createElement("div"));

		expect(getVisibleTaskPathsFromBasesRoot(root)).toEqual(["Tasks/a.md", "Tasks/b.md"]);
		expect(getVisibleTaskPathsFromBasesRoot(null)).toEqual([]);
	});
});
