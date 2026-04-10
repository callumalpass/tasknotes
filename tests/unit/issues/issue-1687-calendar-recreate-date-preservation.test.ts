import { describe, expect, it } from "@jest/globals";

import { shouldPreserveVisibleDateOnCalendarRecreate } from "../../../src/bases/calendarRecreateUtils";

describe("issue #1687 calendar recreate date preservation", () => {
	it("preserves the visible date when unrelated calendar config changes", () => {
		expect(
			shouldPreserveVisibleDateOnCalendarRecreate(
				{
					initialDate: "",
					initialDateProperty: null,
					initialDateStrategy: "first",
				},
				{
					initialDate: "",
					initialDateProperty: null,
					initialDateStrategy: "first",
				}
			)
		).toBe(true);
	});

	it("does not preserve the visible date when explicit initial date changes", () => {
		expect(
			shouldPreserveVisibleDateOnCalendarRecreate(
				{
					initialDate: "",
					initialDateProperty: null,
					initialDateStrategy: "first",
				},
				{
					initialDate: "2026-03-01",
					initialDateProperty: null,
					initialDateStrategy: "first",
				}
			)
		).toBe(false);
	});

	it("does not preserve the visible date when initial date property or strategy changes", () => {
		expect(
			shouldPreserveVisibleDateOnCalendarRecreate(
				{
					initialDate: "",
					initialDateProperty: "scheduled",
					initialDateStrategy: "first",
				},
				{
					initialDate: "",
					initialDateProperty: "due",
					initialDateStrategy: "earliest",
				}
			)
		).toBe(false);
	});
});
