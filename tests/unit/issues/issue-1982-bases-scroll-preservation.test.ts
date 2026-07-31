import { BasesViewBase } from "../../../src/bases/BasesViewBase";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

class TestBasesView extends BasesViewBase {
	type = "tasknotesTaskList";
	renderCount = 0;

	async render(): Promise<void> {
		this.renderCount += 1;
		this.containerEl.scrollTop = 0;
		this.rootElement!.scrollTop = 0;
	}

	renderError(): void {}

	protected async handleTaskUpdate(_task: TaskInfo): Promise<void> {}

	setRootElement(root: HTMLElement): void {
		this.rootElement = root;
	}

	triggerDebouncedRefresh(): void {
		this.debouncedRefresh();
	}
}

function createPlugin(): TaskNotesPlugin {
	return {
		fieldMapper: {
			isRecognizedProperty: jest.fn().mockReturnValue(false),
		},
		settings: {
			enableDebugLogging: false,
		},
	} as unknown as TaskNotesPlugin;
}

function createView(): { view: TestBasesView; container: HTMLElement; root: HTMLElement } {
	const container = document.createElement("div");
	const root = document.createElement("div");
	container.appendChild(root);
	document.body.appendChild(container);

	const view = new TestBasesView({}, container, createPlugin());
	view.setRootElement(root);
	view.data = { data: [], groupedData: [] } as never;

	return { view, container, root };
}

describe("Issue #1982: Bases scroll preservation", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		document.body.replaceChildren();
		jest.useRealTimers();
	});

	it("preserves the Obsidian Bases wrapper scroll during data update renders", async () => {
		const { view, container, root } = createView();
		container.scrollTop = 820;
		root.scrollTop = 410;

		view.onDataUpdated();
		jest.advanceTimersByTime(500);
		await Promise.resolve();

		expect(view.renderCount).toBe(1);
		expect(container.scrollTop).toBe(820);
		expect(root.scrollTop).toBe(410);
	});

	it("preserves the Obsidian Bases wrapper scroll during debounced task refreshes", async () => {
		const { view, container, root } = createView();
		container.scrollTop = 640;
		root.scrollTop = 320;

		view.triggerDebouncedRefresh();
		jest.advanceTimersByTime(300);
		await Promise.resolve();

		expect(view.renderCount).toBe(1);
		expect(container.scrollTop).toBe(640);
		expect(root.scrollTop).toBe(320);
	});
});
