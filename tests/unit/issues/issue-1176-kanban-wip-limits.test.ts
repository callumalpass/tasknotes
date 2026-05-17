/**
 * Issue #1176: Kanban columns can show WIP limits and mark exceeded columns.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1176
 */

import {
	formatKanbanColumnCount,
	normalizeKanbanWipLimitsConfig,
} from "../../../src/bases/KanbanView";

jest.mock("obsidian");

describe("Issue #1176: Kanban WIP limits", () => {
	it("normalizes WIP limit config from JSON strings and objects", () => {
		expect(
			normalizeKanbanWipLimitsConfig('{"todo":5,"in-progress":"3","done":0,"bad":"x"}')
		).toEqual({
			todo: 5,
			"in-progress": 3,
		});

		expect(
			normalizeKanbanWipLimitsConfig({
				Review: 2.8,
				Blocked: 1,
				Ignored: -1,
			})
		).toEqual({
			Review: 2,
			Blocked: 1,
		});
	});

	it("formats plain counts when no positive WIP limit is configured", () => {
		expect(formatKanbanColumnCount(4, undefined)).toEqual({
			text: " (4)",
			isExceeded: false,
		});
		expect(formatKanbanColumnCount(4, 0)).toEqual({
			text: " (4)",
			isExceeded: false,
		});
	});

	it("formats WIP counts and marks exceeded limits", () => {
		expect(formatKanbanColumnCount(3, 5)).toEqual({
			text: " (3/5)",
			isExceeded: false,
		});
		expect(formatKanbanColumnCount(6, 5)).toEqual({
			text: " (6/5)",
			isExceeded: true,
		});
	});
});
