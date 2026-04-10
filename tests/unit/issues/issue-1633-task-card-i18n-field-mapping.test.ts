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
import { resolveTaskCardPropertyLabel } from "../../../src/ui/taskCardPresentation";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("Issue #1633: TaskCard label localization + property display names", () => {
	it("uses presentation helpers and translation-backed labels instead of hardcoded strings", () => {
		const taskCardSource = readRepoFile("src/ui/TaskCard.ts");
		const bootstrapSource = readRepoFile("src/bootstrap/pluginBootstrap.ts");

		const addRibbonIconCalls = (bootstrapSource.match(/addRibbonIcon\(/g) || []).length;
		const translatedRibbonIconCalls = (bootstrapSource.match(/addRibbonIcon\([\s\S]*?i18n\.translate\(/g) || []).length;

		expect(addRibbonIconCalls).toBeGreaterThan(0);
		expect(translatedRibbonIconCalls).toBe(addRibbonIconCalls);
		expect(taskCardSource.includes('"Due: Today"')).toBe(false);
		expect(taskCardSource.includes('"Scheduled: Today"')).toBe(false);
		expect(taskCardSource.includes("Recurring:")).toBe(false);
		expect(taskCardSource.includes("propertyId.charAt(0).toUpperCase() + propertyId.slice(1)")).toBe(false);
		expect(taskCardSource.includes("getTaskCardPropertyLabel")).toBe(true);
		expect(resolveTaskCardPropertyLabel("file.tags")).toBe("File.tags");
		expect(
			resolveTaskCardPropertyLabel("file.tags", { propertyLabels: { "file.tags": "Tags" } })
		).toBe("Tags");
	});
});
