import { PomodoroView } from "../../../src/views/PomodoroView";
import { EVENT_POMODORO_TICK, PomodoroState } from "../../../src/types";
import type { WorkspaceLeaf } from "obsidian";

// Exercise the real event handlers and DOM updates without mounting Obsidian's workspace.
type ViewInternals = {
	updateDisplay(): void;
	updateTaskCardDisplay(task: null): void;
	handleVisibilityChange(): void;
	setupResizeHandling(): void;
	updateResponsiveLayout(): void;
	updateTimer(seconds: number): void;
	timerDisplay: HTMLElement;
	sessionMetaDisplay: HTMLElement;
	progressCircle: SVGCircleElement;
	statusDisplay: HTMLElement;
	startButton: HTMLButtonElement;
	pauseButton: HTMLButtonElement;
	stopButton: HTMLButtonElement;
	taskCardContainer: HTMLElement;
	currentCircumference: number;
};

function fixture() {
	let visible = true;
	const callbacks = new Map<string, (payload?: unknown) => void>();
	const workspaceCallbacks = new Map<string, () => void>();
	const state: PomodoroState = {
		isRunning: true,
		timeRemaining: 120,
		currentSession: {
			id: "test",
			type: "work",
			completed: false,
			plannedDuration: 2,
			startTime: new Date().toISOString(),
			activePeriods: [{ startTime: new Date().toISOString() }],
		},
	};
	const plugin = {
		emitter: {
			on: jest.fn((name: string, callback: (payload?: unknown) => void) => {
				callbacks.set(name, callback);
				return { name, callback };
			}),
			offref: jest.fn(),
		},
		app: {
			workspace: {
				on: jest.fn((name: string, callback: () => void) => {
					workspaceCallbacks.set(name, callback);
					return { name, callback };
				}),
				offref: jest.fn(),
			},
		},
		onReady: jest.fn(async () => undefined),
		settings: { calendarViewSettings: { timeFormat: "24" } },
		i18n: {
			translate: (key: string, params?: object) => `${key}:${JSON.stringify(params ?? {})}`,
		},
		pomodoroService: { getState: () => ({ ...state }) },
	};
	const view = new PomodoroView(
		{} as WorkspaceLeaf,
		plugin as unknown as ConstructorParameters<typeof PomodoroView>[1]
	);
	const content = document.createElement("div");
	Object.defineProperty(view, "contentEl", { value: content });
	Object.defineProperty(content, "isShown", { value: () => visible });
	const root = document.createElement("div");
	root.className = "pomodoro-view";
	content.append(root);
	document.body.append(content);
	const internals = view as unknown as ViewInternals;
	for (const key of [
		"timerDisplay",
		"sessionMetaDisplay",
		"statusDisplay",
		"taskCardContainer",
	] as const) {
		internals[key] = document.createElement("div");
		root.append(internals[key]);
	}
	for (const key of ["startButton", "pauseButton", "stopButton"] as const) {
		internals[key] = document.createElement("button");
		root.append(internals[key]);
	}
	internals.progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	root.append(internals.progressCircle);
	internals.currentCircumference = 100;
	const tick = () =>
		callbacks.get(EVENT_POMODORO_TICK)?.({
			session: state.currentSession,
			timeRemaining: state.timeRemaining,
		});
	return {
		view,
		internals,
		content,
		root,
		state,
		plugin,
		tick,
		workspaceCallbacks,
		setVisible: (value: boolean) => {
			visible = value;
		},
	};
}

describe("Issue #2356: economical Pomodoro rendering", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-09-21T10:00:00Z"));
	});
	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
		document.body.replaceChildren();
	});

	it("updates the countdown once per tick without rewriting unchanged controls", () => {
		const { internals, tick } = fixture();
		internals.updateDisplay();
		const timer = jest.spyOn(internals, "updateTimer");
		const observer = new MutationObserver(() => undefined);
		observer.observe(internals.startButton, { attributes: true, childList: true });
		observer.observe(internals.statusDisplay, { attributes: true, childList: true });
		jest.advanceTimersByTime(1000);
		tick();
		expect(timer).toHaveBeenCalledTimes(1);
		expect(internals.timerDisplay.textContent).toBe("01:59");
		expect(Number(internals.progressCircle.getAttribute("stroke-dashoffset"))).toBeCloseTo(
			(100 * 119) / 120
		);
		expect(observer.takeRecords()).toHaveLength(0);
		observer.disconnect();
	});

	it("does not mutate the DOM on a redundant tick", () => {
		const { internals, content, tick } = fixture();
		internals.updateDisplay();
		const observer = new MutationObserver(() => undefined);
		observer.observe(content, {
			attributes: true,
			childList: true,
			subtree: true,
			characterData: true,
		});
		tick();
		expect(observer.takeRecords()).toHaveLength(0);
		observer.disconnect();
	});

	it("handles pause/resume and queued breaks as state transitions, suppressing paused animation", () => {
		const { internals, state, tick, root } = fixture();
		internals.updateDisplay();
		jest.advanceTimersByTime(65000);
		tick();
		expect(
			internals.timerDisplay.classList.contains("pomodoro-view__timer-display--warning")
		).toBe(true);
		state.isRunning = false;
		state.timeRemaining = 55;
		tick();
		expect(root.classList.contains("pomodoro-view--rendering-paused")).toBe(true);
		expect(internals.startButton.textContent).toContain("resume");
		expect(internals.statusDisplay.textContent).toContain("paused");
		state.isRunning = true;
		tick();
		expect(root.classList.contains("pomodoro-view--rendering-paused")).toBe(false);
		expect(
			internals.startButton.classList.contains("pomodoro-view__start-button--hidden")
		).toBe(true);
		state.isRunning = false;
		state.currentSession = undefined;
		state.nextSessionType = "short-break";
		tick();
		expect(internals.startButton.textContent).toContain("startShortBreak");
	});

	it("defers hidden countdowns and task cards, then catches up immediately when shown", () => {
		const { internals, content, root, tick, setVisible } = fixture();
		internals.handleVisibilityChange();
		setVisible(false);
		internals.handleVisibilityChange();
		expect(root.classList.contains("pomodoro-view--rendering-paused")).toBe(true);
		const observer = new MutationObserver(() => undefined);
		observer.observe(content, { attributes: true, childList: true, subtree: true });
		jest.advanceTimersByTime(10000);
		tick();
		internals.updateTaskCardDisplay(null);
		expect(observer.takeRecords()).toHaveLength(0);
		setVisible(true);
		internals.handleVisibilityChange();
		expect(internals.timerDisplay.textContent).toBe("01:50");
		expect(
			internals.taskCardContainer.classList.contains(
				"pomodoro-view__task-card-container--empty"
			)
		).toBe(true);
		expect(root.classList.contains("pomodoro-view--rendering-paused")).toBe(false);
		observer.disconnect();
	});

	it("does not render while the document is backgrounded", () => {
		const { internals, tick } = fixture();
		internals.updateDisplay();
		const visibility = jest.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
		jest.advanceTimersByTime(10000);
		tick();
		expect(internals.timerDisplay.textContent).toBe("02:00");
		visibility.mockRestore();
		internals.handleVisibilityChange();
		expect(internals.timerDisplay.textContent).toBe("01:50");
	});

	it("does not rewrite responsive layout when pane dimensions are unchanged", () => {
		const { internals, content, root } = fixture();
		jest.spyOn(content, "getBoundingClientRect").mockReturnValue({
			width: 300,
			height: 600,
		} as DOMRect);
		internals.updateResponsiveLayout();
		expect(root.classList.contains("pomodoro-view--very-narrow")).toBe(true);
		const observer = new MutationObserver(() => undefined);
		observer.observe(root, { attributes: true, childList: true, subtree: true });
		internals.updateResponsiveLayout();
		expect(observer.takeRecords()).toHaveLength(0);
		observer.disconnect();
	});

	it("cancels pending layout work and removes listeners from their owning emitter", async () => {
		const { view, internals, plugin, workspaceCallbacks } = fixture();
		const disconnectResize = jest.spyOn(ResizeObserver.prototype, "disconnect");
		const disconnectVisibility = jest.spyOn(IntersectionObserver.prototype, "disconnect");
		const removeDocumentListener = jest.spyOn(document, "removeEventListener");
		const removeWindowListener = jest.spyOn(window, "removeEventListener");
		internals.setupResizeHandling();
		workspaceCallbacks.get("layout-change")?.();
		const layout = jest.spyOn(internals, "updateResponsiveLayout");
		await view.onClose();
		jest.runOnlyPendingTimers();
		workspaceCallbacks.get("active-leaf-change")?.(); // A queued callback after disposal is harmless.
		expect(layout).not.toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
		expect(plugin.app.workspace.offref).toHaveBeenCalledTimes(2);
		expect(disconnectResize).toHaveBeenCalledTimes(1);
		expect(disconnectVisibility).toHaveBeenCalledTimes(1);
		expect(removeDocumentListener).toHaveBeenCalledWith(
			"visibilitychange",
			expect.any(Function)
		);
		expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
		for (const [ref] of plugin.app.workspace.offref.mock.calls) {
			expect(plugin.emitter.offref).not.toHaveBeenCalledWith(ref);
		}
	});

	it("cancels the old window's timer when a leaf moves to a popout", async () => {
		const { view, internals, content, workspaceCallbacks } = fixture();
		internals.setupResizeHandling();
		workspaceCallbacks.get("layout-change")?.();
		const clearOldTimer = jest.spyOn(window, "clearTimeout");
		const iframe = document.createElement("iframe");
		document.body.append(iframe);
		const popoutDocument = iframe.contentDocument!;
		const popoutWindow = iframe.contentWindow!;
		Object.defineProperty(popoutWindow, "ResizeObserver", { value: ResizeObserver });
		Object.defineProperty(popoutWindow, "IntersectionObserver", {
			value: IntersectionObserver,
		});
		popoutDocument.body.append(popoutDocument.adoptNode(content));
		view.onResize();
		expect(clearOldTimer).toHaveBeenCalledTimes(1);
		expect(jest.getTimerCount()).toBe(0);
		await view.onClose();
		iframe.remove();
	});

	it("observes an initially hidden zero-size pane without setup retry timers", async () => {
		const { view, internals, content, root, setVisible } = fixture();
		const observe = jest.spyOn(ResizeObserver.prototype, "observe");
		setVisible(false);
		internals.setupResizeHandling();
		expect(observe).toHaveBeenCalledWith(content);
		expect(jest.getTimerCount()).toBe(0);
		jest.spyOn(content, "getBoundingClientRect").mockReturnValue({
			width: 300,
			height: 600,
		} as DOMRect);
		setVisible(true);
		view.onResize();
		expect(internals.timerDisplay.textContent).toBe("02:00");
		expect(root.classList.contains("pomodoro-view--very-narrow")).toBe(true);
		await view.onClose();
	});

	it("does not render or install observers if closed while waiting for plugin readiness", async () => {
		const { view, internals, plugin } = fixture();
		let ready!: () => void;
		plugin.onReady.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					ready = resolve;
				})
		);
		const render = jest.spyOn(view, "render").mockResolvedValue();
		const setup = jest.spyOn(internals, "setupResizeHandling");
		const opening = view.onOpen();
		await view.onClose();
		ready();
		await opening;
		expect(render).not.toHaveBeenCalled();
		expect(setup).not.toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
	});
});
