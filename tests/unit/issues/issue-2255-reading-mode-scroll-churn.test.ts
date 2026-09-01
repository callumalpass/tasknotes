import { MarkdownView } from "obsidian";
import { observeReadingModeWidgetMutations } from "../../../src/editor/ReadingModeWidgetObserver";

const WIDGET_SELECTOR = ".tasknotes-task-card-note-widget";

function createPreviewDom(): HTMLElement {
	const containerEl = document.createElement("div");
	containerEl.innerHTML = `
		<div class="markdown-preview-view markdown-rendered">
			<div class="markdown-preview-sizer markdown-preview-section">
				<div class="markdown-preview-pusher"></div>
				<div class="mod-header mod-ui"><div class="inline-title">Task</div></div>
				<p>Body</p>
			</div>
		</div>
	`;
	document.body.appendChild(containerEl);
	return containerEl;
}

function flushFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Emits a mutation batch that touches the widget selector without leaving a
 * widget behind — mirroring Obsidian's virtualiser deleting the injected card.
 */
function simulateWidgetRemoval(containerEl: HTMLElement): void {
	const sizer = containerEl.querySelector(".markdown-preview-sizer");
	if (!sizer) throw new Error("missing sizer");
	const widget = document.createElement("div");
	widget.className = "tasknotes-plugin tasknotes-task-card-note-widget";
	sizer.appendChild(widget);
	sizer.removeChild(widget);
}

describe("Issue #2255: defer reading mode widget re-injection while scrolling", () => {
	let cleanups: Array<() => void>;
	let observedContainers: WeakSet<HTMLElement>;

	beforeEach(() => {
		cleanups = [];
		observedContainers = new WeakSet<HTMLElement>();
	});

	afterEach(() => {
		cleanups.forEach((cleanup) => cleanup());
		document.body.innerHTML = "";
	});

	function register(
		containerEl: HTMLElement,
		options?: Parameters<typeof observeReadingModeWidgetMutations>[6],
		scheduleInjection = jest.fn()
	) {
		const view = Object.assign(Object.create(MarkdownView.prototype), {
			containerEl,
			previewMode: { containerEl },
			getMode: jest.fn(() => "preview"),
		}) as MarkdownView;
		const leaf = { parent: {}, view } as any;

		observeReadingModeWidgetMutations(
			leaf,
			WIDGET_SELECTOR,
			scheduleInjection,
			observedContainers,
			cleanups,
			() => true,
			options
		);
		return scheduleInjection;
	}

	it("injects immediately when no scrolling has occurred", async () => {
		const containerEl = createPreviewDom();
		const scheduleInjection = register(containerEl);

		simulateWidgetRemoval(containerEl);
		await flushFrame();

		expect(scheduleInjection).toHaveBeenCalled();
	});

	it("waits for scrolling to settle before re-injecting", async () => {
		const containerEl = createPreviewDom();
		const scheduleInjection = register(containerEl, { scrollQuietPeriodMs: 80 });

		containerEl.dispatchEvent(new Event("scroll"));
		simulateWidgetRemoval(containerEl);

		await flushFrame();
		await flushFrame();

		// Still inside the quiet period: no injection despite the widget being gone.
		expect(scheduleInjection).not.toHaveBeenCalled();

		await sleep(120);

		// Polling continues past the quiet period and restores the widget once.
		expect(scheduleInjection).toHaveBeenCalledTimes(1);
	});

	it("re-injects right away when the last scroll is older than the quiet period", async () => {
		const containerEl = createPreviewDom();
		const scheduleInjection = register(containerEl, { scrollQuietPeriodMs: 40 });

		containerEl.dispatchEvent(new Event("scroll"));
		await sleep(60);

		simulateWidgetRemoval(containerEl);
		await flushFrame();

		expect(scheduleInjection).toHaveBeenCalled();
	});
});
