import { observeTranslation as mockObserveTranslation, englishText as mockEnglishText, conceptDescriptor as mockConceptDescriptor } from "../../helpers/real-i18n";
import { msg } from "@lingui/core/macro";
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
			translate: mockObserveTranslation(),
		},
	};
}

describe("Issue #1787: recurrence tooltip clutter", () => {
	it("does not include the click-to-change helper text", () => {
		const tooltip = getRecurrenceTooltip(createPlugin(), "FREQ=DAILY");

		expect(tooltip).toBe("Recurring: Daily");
		expect(tooltip).not.toContain("click to change");
	});
});
