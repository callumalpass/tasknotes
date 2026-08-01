import { DateTimePickerModal } from "../../../src/modals/DateTimePickerModal";
import type TaskNotesPlugin from "../../../src/main";

/**
 * Regression test for issue #2046:
 * "Quick Actions for Task Under Cursor 'Set due date' autofocuses incorrectly"
 *
 * Expected behavior:
 *   When the user opens the date/time picker from Quick Actions (or any
 *   keyboard-driven path) and natural language input is enabled, the
 *   natural language input should receive initial focus — NOT the date
 *   input. When NLP is disabled, fall back to the date input.
 */

function makeNLPEnabledPlugin(): TaskNotesPlugin {
	return {
		settings: { enableNaturalLanguageInput: true },
	} as unknown as TaskNotesPlugin;
}

describe("Issue #2046: DateTimePickerModal focuses natural language input first when enabled", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("focuses the natural language input when NLP is enabled and rendered", () => {
		const onSelect = jest.fn();
		const plugin = makeNLPEnabledPlugin();

		const modal = new DateTimePickerModal({} as any, {
			currentDate: null,
			onSelect,
			plugin,
		});

		modal.open();

		const nlpInput = modal.contentEl.querySelector<HTMLInputElement>(
			"input.date-time-picker-modal__nlp-input"
		);
		const dateInput = modal.contentEl.querySelector<HTMLInputElement>(
			'input[type="date"].date-time-picker-modal__date-input'
		);
		expect(nlpInput).toBeTruthy();
		expect(dateInput).toBeTruthy();

		const nlpFocus = jest.spyOn(nlpInput!, "focus");
		const dateFocus = jest.spyOn(dateInput!, "focus");

		jest.advanceTimersByTime(150);

		expect(nlpFocus).toHaveBeenCalled();
		expect(dateFocus).not.toHaveBeenCalled();
	});

	it("falls back to the date input when NLP is disabled", () => {
		const onSelect = jest.fn();
		const plugin = {
			settings: { enableNaturalLanguageInput: false },
		} as unknown as TaskNotesPlugin;

		const modal = new DateTimePickerModal({} as any, {
			currentDate: null,
			onSelect,
			plugin,
		});

		modal.open();

		const nlpInput = modal.contentEl.querySelector<HTMLInputElement>(
			"input.date-time-picker-modal__nlp-input"
		);
		const dateInput = modal.contentEl.querySelector<HTMLInputElement>(
			'input[type="date"].date-time-picker-modal__date-input'
		);
		expect(nlpInput).toBeFalsy();
		expect(dateInput).toBeTruthy();

		const dateFocus = jest.spyOn(dateInput!, "focus");

		jest.advanceTimersByTime(150);

		expect(dateFocus).toHaveBeenCalled();
	});

	it("does not throw if NLP is enabled but the input ref is not assigned", () => {
		// Defensive: if the render pipeline ever changes and the ref is not
		// assigned, focus should still fall back to the date input rather than
		// crashing the modal.
		const onSelect = jest.fn();
		const plugin = makeNLPEnabledPlugin();

		const modal = new DateTimePickerModal({} as any, {
			currentDate: null,
			onSelect,
			plugin,
		});

		modal.open();

		(
			modal as unknown as { naturalLanguageInput: HTMLInputElement | null }
		).naturalLanguageInput = null;

		const dateInput = modal.contentEl.querySelector<HTMLInputElement>(
			'input[type="date"].date-time-picker-modal__date-input'
		);
		const dateFocus = jest.spyOn(dateInput!, "focus");

		expect(() => jest.advanceTimersByTime(150)).not.toThrow();
		expect(dateFocus).toHaveBeenCalled();
	});
});
