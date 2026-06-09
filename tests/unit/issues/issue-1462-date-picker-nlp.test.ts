/**
 * Issue #1462: existing task due/scheduled dates should be editable with NLP.
 *
 * Date editing uses the shared date/time picker, so adding NLP there covers
 * task cards, task modals, and quick-action date edits without a new setting.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1462
 */

import {
	DateTimePickerModal,
	getParsedDateTimeSelection,
	parseNaturalLanguageDateTime,
} from "../../../src/modals/DateTimePickerModal";
import type { ParsedTaskData } from "../../../src/services/NaturalLanguageParser";

function parsedTaskData(overrides: Partial<ParsedTaskData>): ParsedTaskData {
	return {
		title: "",
		tags: [],
		contexts: [],
		projects: [],
		...overrides,
	};
}

describe("Issue #1462: NLP date edits", () => {
	it("prefers the date field matching the current picker role", () => {
		const parsed = {
			dueDate: "2026-01-20",
			dueTime: "15:30",
			scheduledDate: "2026-01-18",
			scheduledTime: "09:00",
		};

		expect(getParsedDateTimeSelection(parsed, "due")).toEqual({
			date: "2026-01-20",
			time: "15:30",
		});
		expect(getParsedDateTimeSelection(parsed, "scheduled")).toEqual({
			date: "2026-01-18",
			time: "09:00",
		});
	});

	it("falls back to whichever parsed date exists so plain NLP works in either picker", () => {
		const parsed = {
			scheduledDate: "2026-01-21",
			scheduledTime: "10:15",
		};

		expect(getParsedDateTimeSelection(parsed, "due")).toEqual({
			date: "2026-01-21",
			time: "10:15",
		});
	});

	it("parses natural-language input through the configured parser", () => {
		const parser = {
			parseInput: jest.fn(() =>
				parsedTaskData({
					dueDate: "2026-01-22",
					dueTime: "16:45",
				})
			),
		};

		expect(parseNaturalLanguageDateTime(" next Thursday at 4:45pm ", parser, "due")).toEqual({
			date: "2026-01-22",
			time: "16:45",
		});
		expect(parser.parseInput).toHaveBeenCalledWith("next Thursday at 4:45pm");
	});

	it("applies NLP input from the date picker without changing date picker callers", () => {
		const onSelect = jest.fn();
		const parser = {
			parseInput: jest.fn(() =>
				parsedTaskData({
					scheduledDate: "2026-01-23",
					scheduledTime: "08:00",
				})
			),
		};
		const modal = new DateTimePickerModal({} as any, {
			dateRole: "scheduled",
			naturalLanguageParser: parser,
			onSelect,
		});

		modal.open();

		const input = modal.contentEl.querySelector<HTMLInputElement>(
			".date-time-picker-modal__nlp-input"
		);
		expect(input).toBeTruthy();

		input!.value = "next Friday at 8am";
		input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

		expect(onSelect).toHaveBeenCalledWith("2026-01-23", "08:00");
	});
});
