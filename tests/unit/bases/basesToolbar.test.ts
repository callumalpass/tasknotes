import {
	cleanupBasesNewTaskButton,
	injectBasesNewTaskButton,
} from "../../../src/bases/basesToolbar";

function createBasesToolbarDom(): {
	containerEl: HTMLElement;
	parentEl: HTMLElement;
	toolbarEl: HTMLElement;
	originalNewButton: HTMLElement;
} {
	const parentEl = document.createElement("div");
	const toolbarEl = document.createElement("div");
	toolbarEl.className = "bases-toolbar";
	const originalNewButton = document.createElement("button");
	originalNewButton.className = "bases-toolbar-new-item-menu";
	toolbarEl.appendChild(originalNewButton);
	const basesViewEl = document.createElement("div");
	basesViewEl.className = "bases-view";
	const containerEl = document.createElement("div");
	basesViewEl.appendChild(containerEl);
	parentEl.append(toolbarEl, basesViewEl);
	document.body.appendChild(parentEl);
	return { containerEl, parentEl, toolbarEl, originalNewButton };
}

describe("Bases toolbar helpers", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("injects a TaskNotes New button before the native Bases new button", () => {
		const { containerEl, parentEl, toolbarEl, originalNewButton } = createBasesToolbarDom();
		const onClick = jest.fn();

		const result = injectBasesNewTaskButton({
			containerEl,
			label: "New",
			onClick,
		});

		const injected = toolbarEl.querySelector<HTMLDivElement>(".tn-bases-new-task-btn");
		expect(result).toBe("injected");
		expect(parentEl.classList.contains("tasknotes-view-active")).toBe(true);
		expect(injected).not.toBeNull();
		expect(toolbarEl.firstElementChild).toBe(injected);
		expect(injected?.nextElementSibling).toBe(originalNewButton);
		expect(injected?.querySelector("button")?.getAttribute("aria-label")).toBe("New");
		expect(injected?.querySelector(".text-button-label")?.textContent).toBe("New");

		injected?.querySelector("button")?.dispatchEvent(
			new MouseEvent("click", { bubbles: true, cancelable: true })
		);

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("replaces stale injected buttons and appends when the native button is missing", () => {
		const { containerEl, toolbarEl, originalNewButton } = createBasesToolbarDom();
		originalNewButton.remove();
		const staleButton = document.createElement("div");
		staleButton.className = "tn-bases-new-task-btn";
		toolbarEl.appendChild(staleButton);

		const result = injectBasesNewTaskButton({
			containerEl,
			label: "New task",
			onClick: jest.fn(),
		});

		expect(result).toBe("injected");
		const injectedButtons = toolbarEl.querySelectorAll(".tn-bases-new-task-btn");
		expect(injectedButtons).toHaveLength(1);
		expect(injectedButtons[0]).not.toBe(staleButton);
		expect(toolbarEl.lastElementChild).toBe(injectedButtons[0]);
	});

	it("cleans up injected button state", () => {
		const { containerEl, parentEl, toolbarEl } = createBasesToolbarDom();
		injectBasesNewTaskButton({
			containerEl,
			label: "New",
			onClick: jest.fn(),
		});

		cleanupBasesNewTaskButton(containerEl);

		expect(toolbarEl.querySelector(".tn-bases-new-task-btn")).toBeNull();
		expect(parentEl.classList.contains("tasknotes-view-active")).toBe(false);
	});

	it("reports missing integration surfaces without throwing", () => {
		expect(
			injectBasesNewTaskButton({
				containerEl: document.createElement("div"),
				label: "New",
				onClick: jest.fn(),
			})
		).toBe("missing-bases-view");

		const parentEl = document.createElement("div");
		const basesViewEl = document.createElement("div");
		basesViewEl.className = "bases-view";
		const containerEl = document.createElement("div");
		basesViewEl.appendChild(containerEl);
		parentEl.appendChild(basesViewEl);
		document.body.appendChild(parentEl);

		expect(
			injectBasesNewTaskButton({
				containerEl,
				label: "New",
				onClick: jest.fn(),
			})
		).toBe("missing-toolbar");
	});
});
