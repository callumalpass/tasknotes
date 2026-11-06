import type { EventRef } from "obsidian";
import { registerBasesDateRollover } from "../../../src/bases/basesDateRollover";
import { EVENT_DATE_CHANGED } from "../../../src/types";

const nov4 = new Date(2026, 10, 4, 23, 59);
const nov5 = new Date(2026, 10, 5, 0, 0, 1);
const nov7 = new Date(2026, 10, 7, 9, 0);

function harness() {
	let emit: (() => void) | null = null;
	const ref = {} as EventRef;
	const emitter = {
		on: jest.fn((_event: string, callback: () => void) => {
			emit = callback;
			return ref;
		}),
		offref: jest.fn(),
	};
	const observers: { notify: () => void; observe: jest.Mock; disconnect: jest.Mock }[] = [];
	class FakeResizeObserver {
		observe = jest.fn();
		disconnect = jest.fn();
		constructor(public notify: () => void) {
			observers.push(this);
		}
	}
	let shown = true;
	const element = {
		getClientRects: () => (shown ? [{}] : []),
		ownerDocument: { defaultView: { ResizeObserver: FakeResizeObserver } },
	} as unknown as HTMLElement;
	const onDateRollover = jest.fn();
	const cleanup = registerBasesDateRollover({
		emitter,
		getElement: () => element,
		onDateRollover,
	});
	return {
		emit: () => emit?.(),
		emitter,
		ref,
		observers,
		onDateRollover,
		cleanup,
		setShown: (value: boolean) => {
			shown = value;
		},
	};
}

describe("Bases date rollover", () => {
	beforeEach(() => jest.useFakeTimers().setSystemTime(nov4));
	afterEach(() => jest.useRealTimers());

	it("redraws a visible view once, with the day it last drew", () => {
		const view = harness();
		expect(view.emitter.on).toHaveBeenCalledWith(EVENT_DATE_CHANGED, expect.any(Function));

		jest.setSystemTime(nov5);
		view.emit();
		view.emit();

		expect(view.onDateRollover).toHaveBeenCalledTimes(1);
		expect(view.onDateRollover).toHaveBeenCalledWith(nov4.toDateString());
		expect(view.observers).toHaveLength(0);
	});

	it("leaves a hidden view alone until it is shown, across several days", () => {
		const view = harness();
		view.setShown(false);

		jest.setSystemTime(nov5);
		view.emit();
		jest.setSystemTime(nov7);
		view.emit();
		expect(view.observers).toHaveLength(1);

		// ResizeObserver reports its first observation while the view is still hidden.
		view.observers[0].notify();
		expect(view.onDateRollover).not.toHaveBeenCalled();

		view.setShown(true);
		view.observers[0].notify();
		expect(view.onDateRollover).toHaveBeenCalledTimes(1);
		expect(view.onDateRollover).toHaveBeenCalledWith(nov4.toDateString());
		expect(view.observers[0].disconnect).toHaveBeenCalled();
	});

	it("removes the listener and any pending observer on cleanup", () => {
		const view = harness();
		view.setShown(false);
		jest.setSystemTime(nov5);
		view.emit();

		view.cleanup();

		expect(view.emitter.offref).toHaveBeenCalledWith(view.ref);
		expect(view.observers[0].disconnect).toHaveBeenCalled();
	});
});
