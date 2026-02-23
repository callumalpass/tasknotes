/**
 * Issue #1633: Interactive Task UI ignores i18n translations and field mappings
 *
 * Reported by @Sarryaz.
 *
 * The interactive TaskCard renderer in Bases views uses hardcoded English labels
 * (e.g., "Due:", "Scheduled:", "Recurring:") and generic raw property IDs
 * for unknown properties (e.g., "File.tags:"), instead of view display names
 * and i18n-aware labels.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1633
 */

import { describe, expect, it } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("Issue #1633: TaskCard label localization + property display names", () => {
	it.skip("reproduces issue #1633", () => {
		const taskCardSource = readRepoFile("src/ui/TaskCard.ts");
		const mainSource = readRepoFile("src/main.ts");

		const hardcodedDueLabels =
			taskCardSource.includes('"Due: Today"') ||
			taskCardSource.includes('`Due: ${display}`') ||
			taskCardSource.includes('`Due: ${display} (overdue)`');
		const hardcodedScheduledLabels =
			taskCardSource.includes('"Scheduled: Today"') ||
			taskCardSource.includes('`Scheduled: ${display}`') ||
			taskCardSource.includes('`Scheduled: ${display} (past)`');
		const hardcodedRecurringLabels = taskCardSource.includes("Recurring:");
		const genericLabelUsesRawPropertyId = taskCardSource.includes(
			"propertyId.charAt(0).toUpperCase() + propertyId.slice(1)"
		);

		// Current buggy behavior exists.
		expect(hardcodedDueLabels).toBe(true);
		expect(hardcodedScheduledLabels).toBe(true);
		expect(hardcodedRecurringLabels).toBe(true);
		expect(genericLabelUsesRawPropertyId).toBe(true);

		const addRibbonIconCalls = (mainSource.match(/addRibbonIcon\(/g) || []).length;
		const translatedRibbonIconCalls = (mainSource.match(/addRibbonIcon\([^\n]*i18n\.translate\(/g) || []).length;

		// Current sidebar shortcut labels are hardcoded, not i18n-translated.
		expect(addRibbonIconCalls).toBeGreaterThan(0);
		expect(translatedRibbonIconCalls).toBe(0);

		// Expected after fix:
		// 1) TaskCard date/recurrence labels come from i18n and/or Bases display names.
		// 2) Fallback property labels do not derive directly from raw IDs like "file.tags".
		// 3) Ribbon icon labels are translated.
		const taskCardUsesI18nForCoreMetadata =
			taskCardSource.includes("ui.taskCard") &&
			(taskCardSource.includes("due") ||
				taskCardSource.includes("scheduled") ||
				taskCardSource.includes("recurrence"));
		const taskCardHasDisplayNameResolution =
			taskCardSource.includes("getDisplayName") ||
			taskCardSource.includes("displayNameResolver") ||
			taskCardSource.includes("propertyLabels");
		const hasTranslatedRibbonIcons = translatedRibbonIconCalls > 0;

		expect(
			taskCardUsesI18nForCoreMetadata &&
				taskCardHasDisplayNameResolution &&
				hasTranslatedRibbonIcons
		).toBe(true);
	});
});
