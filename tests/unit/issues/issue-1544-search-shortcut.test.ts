/**
 * Regression coverage for issue #1544.
 *
 * Ctrl/Cmd+F should focus the local TaskNotes search box when a Bases view has
 * search enabled, without adding a global Obsidian command or new setting.
 */

import { BasesViewBase } from "../../../src/bases/BasesViewBase";
import type { TaskInfo } from "../../../src/types";

class TestBasesView extends BasesViewBase {
	type = "tasknotesTest";
	private cleanups: Array<() => void> = [];

	render(): void {
		// No-op for this focused shortcut behavior test.
	}

	renderError(): void {
		// No-op for this focused shortcut behavior test.
	}

	register(fn: () => void): void {
		this.cleanups.push(fn);
	}

	protected async handleTaskUpdate(_task: TaskInfo): Promise<void> {
		// No-op for this focused shortcut behavior test.
	}

	enableSearchForTest(container: HTMLElement): void {
		(this as any).enableSearch = true;
		(this as any).rootElement = container;
		(this as any).setupSearch(container);
	}

	unloadForTest(): void {
		for (const cleanup of this.cleanups) {
			cleanup();
		}
		this.cleanups = [];
	}
}

function createMockPlugin() {
	return {
		app: {},
		fieldMapper: {
			toUserField: (field: string) => field,
		},
		settings: {
			userFields: [],
		},
	} as any;
}

describe("Issue #1544: TaskNotes search shortcut", () => {
	let container: HTMLElement;
	let view: TestBasesView;

	beforeEach(() => {
		document.body.innerHTML = "";
		container = document.createElement("div");
		document.body.appendChild(container);
		view = new TestBasesView({}, container, createMockPlugin());
	});

	afterEach(() => {
		view.unloadForTest();
		document.body.innerHTML = "";
	});

	it("focuses and selects the local search input when Ctrl+F is pressed inside a searchable view", () => {
		view.enableSearchForTest(container);
		const input = container.querySelector<HTMLInputElement>(".tn-search-box__input");
		expect(input).not.toBeNull();
		input!.value = "existing search";

		const taskCard = document.createElement("button");
		container.appendChild(taskCard);
		taskCard.focus();

		const event = new KeyboardEvent("keydown", {
			key: "f",
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
		});
		const wasNotCancelled = taskCard.dispatchEvent(event);

		expect(wasNotCancelled).toBe(false);
		expect(document.activeElement).toBe(input);
		expect(input!.selectionStart).toBe(0);
		expect(input!.selectionEnd).toBe(input!.value.length);
	});

	it("leaves non-find shortcuts alone", () => {
		view.enableSearchForTest(container);
		const taskCard = document.createElement("button");
		container.appendChild(taskCard);

		const event = new KeyboardEvent("keydown", {
			key: "f",
			ctrlKey: true,
			shiftKey: true,
			bubbles: true,
			cancelable: true,
		});
		const wasNotCancelled = taskCard.dispatchEvent(event);

		expect(wasNotCancelled).toBe(true);
	});
});
