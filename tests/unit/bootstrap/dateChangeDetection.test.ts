import {
	getMillisecondsUntilNextLocalMidnight,
	startDateChangeDetection,
} from "../../../src/bootstrap/dateChangeDetection";

class FakeTimer {
	private nextId = 1;
	intervals: Array<{ id: number; callback: () => void; timeout: number }> = [];
	timeouts: Array<{ id: number; callback: () => void; timeout: number }> = [];
	clearedTimeouts: number[] = [];

	setInterval(callback: () => void, timeout: number): number {
		const id = this.nextId++;
		this.intervals.push({ id, callback, timeout });
		return id;
	}

	setTimeout(callback: () => void, timeout: number): number {
		const id = this.nextId++;
		this.timeouts.push({ id, callback, timeout });
		return id;
	}

	clearTimeout(timeoutId: number): void {
		this.clearedTimeouts.push(timeoutId);
	}
}

describe("date change detection", () => {
	it("registers a minute interval and schedules the next local midnight", () => {
		const timer = new FakeTimer();
		const registered: number[] = [];

		startDateChangeDetection({
			timer,
			registerTimer: (id) => registered.push(id),
			emitDateChanged: jest.fn(),
			getDateKey: () => "Tue May 19 2026",
			getNow: () => new Date(2026, 4, 19, 23, 30, 0, 0),
		});

		expect(timer.intervals).toHaveLength(1);
		expect(timer.intervals[0].timeout).toBe(60000);
		expect(timer.timeouts).toHaveLength(1);
		expect(timer.timeouts[0].timeout).toBe(30 * 60 * 1000);
		expect(registered).toEqual([timer.intervals[0].id, timer.timeouts[0].id]);
	});

	it("emits only when the date key changes", () => {
		const timer = new FakeTimer();
		let dateKey = "Tue May 19 2026";
		const emitDateChanged = jest.fn();

		const controls = startDateChangeDetection({
			timer,
			registerTimer: jest.fn(),
			emitDateChanged,
			getDateKey: () => dateKey,
			getNow: () => new Date(2026, 4, 19, 12, 0, 0, 0),
		});

		expect(controls.checkDateChange()).toBe(false);
		dateKey = "Wed May 20 2026";

		expect(controls.checkDateChange()).toBe(true);
		expect(controls.getLastKnownDate()).toBe("Wed May 20 2026");
		expect(emitDateChanged).toHaveBeenCalledTimes(1);
		expect(controls.checkDateChange()).toBe(false);
		expect(emitDateChanged).toHaveBeenCalledTimes(1);
	});

	it("clears and replaces the previous midnight timeout when rescheduling", () => {
		const timer = new FakeTimer();
		const registered: number[] = [];

		const controls = startDateChangeDetection({
			timer,
			registerTimer: (id) => registered.push(id),
			emitDateChanged: jest.fn(),
			getDateKey: () => "Tue May 19 2026",
			getNow: () => new Date(2026, 4, 19, 12, 0, 0, 0),
		});

		const firstTimeout = controls.getMidnightTimeout();
		const secondTimeout = controls.scheduleNextMidnightCheck();

		expect(firstTimeout).not.toBeNull();
		expect(secondTimeout).not.toBe(firstTimeout);
		expect(timer.clearedTimeouts).toEqual([firstTimeout]);
		expect(registered).toContain(secondTimeout);
	});

	it("checks the date and schedules the next timeout from the midnight callback", () => {
		const timer = new FakeTimer();
		let dateKey = "Tue May 19 2026";
		let now = new Date(2026, 4, 19, 23, 59, 0, 0);
		const emitDateChanged = jest.fn();

		startDateChangeDetection({
			timer,
			registerTimer: jest.fn(),
			emitDateChanged,
			getDateKey: () => dateKey,
			getNow: () => now,
		});

		dateKey = "Wed May 20 2026";
		now = new Date(2026, 4, 20, 0, 0, 0, 0);
		timer.timeouts[0].callback();

		expect(emitDateChanged).toHaveBeenCalledTimes(1);
		expect(timer.timeouts).toHaveLength(2);
		expect(timer.clearedTimeouts).toEqual([timer.timeouts[0].id]);
	});

	it("computes milliseconds until the next local midnight", () => {
		expect(getMillisecondsUntilNextLocalMidnight(new Date(2026, 4, 19, 23, 0, 0, 0))).toBe(
			60 * 60 * 1000
		);
	});
});
