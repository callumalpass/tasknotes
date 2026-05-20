/**
 * Issue #1898: Calendar view time labels shifted to the center.
 *
 * The stale inline-width reset for FullCalendar slot labels must be paired with
 * a fixed slot-label cell width. Without that CSS width, Day view can let the
 * slot-label column expand to half of the calendar grid after the reset.
 */

import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("Issue #1898: Calendar time labels stay anchored to the axis", () => {
	it("keeps reset slot labels on a fixed time-axis width", () => {
		const source = readRepoFile("src/bases/CalendarView.ts");
		const css = readRepoFile("styles/advanced-calendar-view.css");

		const slotLabelBlock = extractCssBlock(
			css,
			".advanced-calendar-view .fc-timegrid-slot-label"
		);

		expect(source).toContain(".fc-timegrid-slot-label");
		expect(slotLabelBlock).toContain("width: 4rem;");
		expect(slotLabelBlock).toContain("text-align: right;");
	});
});
