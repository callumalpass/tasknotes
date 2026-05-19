export type BasesTimeoutScheduler = {
	setTimeout: (callback: () => void, delayMs: number) => number;
	clearTimeout: (timer: number) => void;
};

type BasesConfigRefreshController = {
	onConfigChanged?: (...args: unknown[]) => unknown;
	view?: unknown;
};

type InstallBasesConfigRefreshHookOptions = {
	controller: unknown;
	view: unknown;
	isConnected: () => boolean;
	refresh: () => void;
	scheduleTimeout: (callback: () => void, delayMs: number) => void;
};

type ScheduleBasesDataUpdateRenderOptions = {
	currentTimer: number | null;
	scheduler: BasesTimeoutScheduler;
	isConnected: () => boolean;
	beforeRender: () => void;
	render: () => void | Promise<void>;
	onTimerCleared: () => void;
	onRenderError: (error: unknown) => void;
	delayMs?: number;
};

type ScheduleBasesDebouncedRefreshOptions = {
	currentTimer: number | null;
	scheduler: BasesTimeoutScheduler;
	render: () => void | Promise<void>;
	onTimerCleared: () => void;
	delayMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function scheduleConfigRefreshAfterResult(
	result: unknown,
	refresh: () => void,
	scheduleTimeout: (callback: () => void, delayMs: number) => void
): void {
	const maybePromise = result as PromiseLike<unknown> | null;
	if (maybePromise && typeof maybePromise.then === "function") {
		void maybePromise.then(refresh, refresh);
		return;
	}

	scheduleTimeout(refresh, 0);
}

export function installBasesConfigRefreshHook({
	controller,
	view,
	isConnected,
	refresh,
	scheduleTimeout,
}: InstallBasesConfigRefreshHookOptions): (() => void) | null {
	if (!isRecord(controller) || typeof controller.onConfigChanged !== "function") {
		return null;
	}

	const basesController = controller as BasesConfigRefreshController;
	const originalOnConfigChanged = basesController.onConfigChanged;
	if (!originalOnConfigChanged) {
		return null;
	}

	const refreshIfCurrentView = () => {
		if (basesController.view && basesController.view !== view) {
			return;
		}
		if (!isConnected()) {
			return;
		}
		refresh();
	};

	const wrappedOnConfigChanged = (...args: unknown[]): unknown => {
		const result = originalOnConfigChanged.apply(basesController, args);
		scheduleConfigRefreshAfterResult(result, refreshIfCurrentView, scheduleTimeout);
		return result;
	};

	basesController.onConfigChanged = wrappedOnConfigChanged;
	return () => {
		if (basesController.onConfigChanged === wrappedOnConfigChanged) {
			basesController.onConfigChanged = originalOnConfigChanged;
		}
	};
}

export function scheduleBasesDataUpdateRender({
	currentTimer,
	scheduler,
	isConnected,
	beforeRender,
	render,
	onTimerCleared,
	onRenderError,
	delayMs = 500,
}: ScheduleBasesDataUpdateRenderOptions): number | null {
	if (!isConnected()) {
		return currentTimer;
	}

	if (currentTimer) {
		scheduler.clearTimeout(currentTimer);
	}

	return scheduler.setTimeout(() => {
		onTimerCleared();
		try {
			beforeRender();
			void render();
		} catch (error) {
			onRenderError(error);
		}
	}, delayMs);
}

export function scheduleBasesDebouncedRefresh({
	currentTimer,
	scheduler,
	render,
	onTimerCleared,
	delayMs = 300,
}: ScheduleBasesDebouncedRefreshOptions): number {
	if (currentTimer) {
		scheduler.clearTimeout(currentTimer);
	}

	return scheduler.setTimeout(() => {
		try {
			void render();
		} finally {
			onTimerCleared();
		}
	}, delayMs);
}
