/**
 * Issue #1787: Remove "(click to change)" from recurrence display on task cards.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1787
 */

import { describe, expect, it } from "@jest/globals";
import { en } from "../../../src/i18n/resources/en";
import { getRecurrenceTooltip } from "../../../src/ui/taskCardHelpers";

function createPlugin(): any {
	return {
		fieldMapper: {
			lookupMappingKey: () => null,
		},
		i18n: {
			translate: (key: string, vars?: Record<string, string | number>) => {
				if (key === "ui.taskCard.labels.recurrence") {
					return en.ui.taskCard.labels.recurrence;
				}

				if (key === "ui.taskCard.recurrenceTooltip") {
					return en.ui.taskCard.recurrenceTooltip
						.replace("{label}", String(vars?.label ?? ""))
						.replace("{value}", String(vars?.value ?? ""));
				}

				return key;
			},
		},
	};
}

describe("Issue #1787: recurrence tooltip clutter", () => {
	it("does not include the click-to-change helper text", () => {
		const tooltip = getRecurrenceTooltip(createPlugin(), "FREQ=DAILY");

		expect(tooltip).toBe("Recurring: every day");
		expect(tooltip).not.toContain("click to change");
	});
});
