/**
 * Issue #1720: tasknotesTaskList renders date-like Bases values as icon names
 * (e.g. "clock") and ignores property display names
 *
 * Bug Description:
 * In a tasknotesTaskList Bases view, date-like properties render as the Lucide icon name
 * (e.g. "clock") instead of the human-readable value. Additionally, property labels use
 * the raw property/formula id instead of the configured Bases display name.
 *
 * Root cause:
 * 1. extractBasesValue() in TaskCard.ts returns v.data before checking v.display or v.date
 *    for non-link Bases value objects. For date-like values, v.data holds the icon token
 *    while v.display holds the human-readable text.
 * 2. renderGenericProperty() derives labels from raw propertyId instead of Bases display names.
 * 3. The date fallback only checks for "lucide-calendar" icon, missing "lucide-clock".
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1720
 */

import { describe, it, expect } from '@jest/globals';
import {
	extractBasesValue,
	resolveTaskCardPropertyLabel,
} from "../../../src/ui/taskCardPresentation";

describe('Issue #1720: Bases date-like value rendering', () => {
	it('prefers display and date fields before raw Bases data', () => {
		expect(
			extractBasesValue({
				icon: "lucide-clock",
				data: "clock",
				display: "13 days ago",
			})
		).toBe("13 days ago");

		expect(
			extractBasesValue({
				icon: "lucide-clock",
				date: "2026-03-13",
				display: "Mar 13",
			})
		).toBe("Mar 13");

		expect(
			extractBasesValue({
				icon: "lucide-calendar",
				data: "calendar",
				date: "2026-03-13",
				display: "Mar 13, 2026",
			})
		).toBe("Mar 13, 2026");
	});

	it('uses Bases display-name plumbing for generic property labels', () => {
		expect(
			resolveTaskCardPropertyLabel("formula.lastTouched", {
				propertyLabels: { "formula.lastTouched": "Last touched" },
			})
		).toBe("Last touched");

		expect(
			resolveTaskCardPropertyLabel("modified-c", {
				propertyLabels: { "modified-c": "Modified" },
			})
		).toBe("Modified");
	});
});
