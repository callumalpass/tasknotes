import {
	installBasesConfigRefreshHook,
	scheduleBasesDataUpdateRender,
	scheduleBasesDebouncedRefresh,
	type BasesTimeoutScheduler,
} from "../../../src/bases/basesRefreshLifecycle";

const scheduler: BasesTimeoutScheduler = {
	setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
	clearTimeout: (timer) => window.clearTimeout(timer),
};

describe("Bases refresh lifecycle helpers", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("wraps config changes, defers refresh, and restores the original handler", () => {
		const view = {};
		let handlerThis: unknown = null;
		const original = jest.fn(function (this: unknown, marker: string) {
			handlerThis = this;
			return `saved:${marker}`;
		});
		const controller = {
			view,
			onConfigChanged: original,
		};
		const refresh = jest.fn();

		const cleanup = installBasesConfigRefreshHook({
			controller,
			view,
			isConnected: () => true,
			refresh,
			scheduleTimeout: (callback, delayMs) => {
				window.setTimeout(callback, delayMs);
			},
		});

		expect(cleanup).not.toBeNull();
		const wrapped = controller.onConfigChanged;
		expect(wrapped?.("config")).toBe("saved:config");
		expect(original).toHaveBeenCalledWith("config");
		expect(handlerThis).toBe(controller);
		expect(refresh).not.toHaveBeenCalled();

		jest.runOnlyPendingTimers();
		expect(refresh).toHaveBeenCalledTimes(1);

		cleanup?.();
		expect(controller.onConfigChanged).toBe(original);
	});

	it("waits for async config saves and ignores stale or disconnected views", async () => {
		const view = {};
		let resolveSave: () => void = () => undefined;
		const controller = {
			view,
			onConfigChanged: jest.fn(
				() =>
					new Promise<void>((resolve) => {
						resolveSave = resolve;
					})
			),
		};
		const refresh = jest.fn();
		let connected = true;

		installBasesConfigRefreshHook({
			controller,
			view,
			isConnected: () => connected,
			refresh,
			scheduleTimeout: (callback, delayMs) => {
				window.setTimeout(callback, delayMs);
			},
		});

		controller.onConfigChanged();
		controller.view = {};
		resolveSave();
		await Promise.resolve();
		expect(refresh).not.toHaveBeenCalled();

		controller.view = view;
		controller.onConfigChanged();
		connected = false;
		resolveSave();
		await Promise.resolve();
		expect(refresh).not.toHaveBeenCalled();
	});

	it("debounces data update renders and reports synchronous render errors", () => {
		const beforeRender = jest.fn();
		const render = jest.fn();
		const onTimerCleared = jest.fn();
		const onRenderError = jest.fn();

		let timer = scheduleBasesDataUpdateRender({
			currentTimer: null,
			scheduler,
			isConnected: () => true,
			beforeRender,
			render,
			onTimerCleared,
			onRenderError,
			delayMs: 500,
		});
		timer = scheduleBasesDataUpdateRender({
			currentTimer: timer,
			scheduler,
			isConnected: () => true,
			beforeRender,
			render,
			onTimerCleared,
			onRenderError,
			delayMs: 500,
		});

		jest.advanceTimersByTime(499);
		expect(render).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		expect(onTimerCleared).toHaveBeenCalledTimes(1);
		expect(beforeRender).toHaveBeenCalledTimes(1);
		expect(render).toHaveBeenCalledTimes(1);
		expect(onRenderError).not.toHaveBeenCalled();

		const error = new Error("render failed");
		scheduleBasesDataUpdateRender({
			currentTimer: null,
			scheduler,
			isConnected: () => true,
			beforeRender,
			render: () => {
				throw error;
			},
			onTimerCleared,
			onRenderError,
			delayMs: 1,
		});
		jest.advanceTimersByTime(1);
		expect(onRenderError).toHaveBeenCalledWith(error);
	});

	it("does not reschedule data updates while the view is disconnected", () => {
		const existingTimer = 1234;
		const clearTimeout = jest.fn();
		const setTimeout = jest.fn();

		const result = scheduleBasesDataUpdateRender({
			currentTimer: existingTimer,
			scheduler: { setTimeout, clearTimeout },
			isConnected: () => false,
			beforeRender: jest.fn(),
			render: jest.fn(),
			onTimerCleared: jest.fn(),
			onRenderError: jest.fn(),
		});

		expect(result).toBe(existingTimer);
		expect(clearTimeout).not.toHaveBeenCalled();
		expect(setTimeout).not.toHaveBeenCalled();
	});

	it("debounces explicit refreshes and clears the timer after rendering", () => {
		const render = jest.fn();
		const onTimerCleared = jest.fn();

		let timer = scheduleBasesDebouncedRefresh({
			currentTimer: null,
			scheduler,
			render,
			onTimerCleared,
			delayMs: 300,
		});
		timer = scheduleBasesDebouncedRefresh({
			currentTimer: timer,
			scheduler,
			render,
			onTimerCleared,
			delayMs: 300,
		});

		jest.advanceTimersByTime(299);
		expect(render).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		expect(render).toHaveBeenCalledTimes(1);
		expect(onTimerCleared).toHaveBeenCalledTimes(1);
	});
});
