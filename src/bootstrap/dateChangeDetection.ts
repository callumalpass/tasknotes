interface DateChangeTimer {
	setInterval(callback: () => void, timeout: number): number;
	setTimeout(callback: () => void, timeout: number): number;
	clearTimeout(timeoutId: number): void;
}

export interface DateChangeDetectionOptions {
	timer?: DateChangeTimer;
	registerTimer: (timerId: number) => void;
	emitDateChanged: () => void;
	getDateKey?: () => string;
	getNow?: () => Date;
	intervalMs?: number;
}

export interface DateChangeDetectionControls {
	checkDateChange: () => boolean;
	scheduleNextMidnightCheck: () => number;
	getLastKnownDate: () => string;
	getMidnightTimeout: () => number | null;
}

export function startDateChangeDetection({
	timer = window,
	registerTimer,
	emitDateChanged,
	getDateKey = () => new Date().toDateString(),
	getNow = () => new Date(),
	intervalMs = 60000,
}: DateChangeDetectionOptions): DateChangeDetectionControls {
	let lastKnownDate = getDateKey();
	let midnightTimeout: number | null = null;

	const checkDateChange = (): boolean => {
		const currentDate = getDateKey();
		if (currentDate === lastKnownDate) {
			return false;
		}

		lastKnownDate = currentDate;
		emitDateChanged();
		return true;
	};

	const scheduleNextMidnightCheck = (): number => {
		const msUntilMidnight = getMillisecondsUntilNextLocalMidnight(getNow());

		if (midnightTimeout !== null) {
			timer.clearTimeout(midnightTimeout);
		}

		midnightTimeout = timer.setTimeout(() => {
			checkDateChange();
			scheduleNextMidnightCheck();
		}, msUntilMidnight);

		registerTimer(midnightTimeout);
		return midnightTimeout;
	};

	const intervalId = timer.setInterval(checkDateChange, intervalMs);
	registerTimer(intervalId);
	scheduleNextMidnightCheck();

	return {
		checkDateChange,
		scheduleNextMidnightCheck,
		getLastKnownDate: () => lastKnownDate,
		getMidnightTimeout: () => midnightTimeout,
	};
}

export function getMillisecondsUntilNextLocalMidnight(now: Date): number {
	const midnight = new Date(now);
	midnight.setHours(24, 0, 0, 0);
	return midnight.getTime() - now.getTime();
}
