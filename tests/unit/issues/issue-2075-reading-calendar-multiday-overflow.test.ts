import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("Issue #2075: Reading mode calendar multiday events", () => {
	it("lets FullCalendar all-day events overflow from their starting day cell", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");
		const dayCellBlock = extractCssBlock(css, ".advanced-calendar-view .fc-daygrid-day");

		expect(dayCellBlock).toContain("overflow: visible;");
	});
});
