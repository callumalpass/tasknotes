import fs from "fs";
import path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/task-modal.css");

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("issue #1895 NLP preview visibility", () => {
	it("uses a visible state selector that can override the hidden preview default", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");

		const hiddenBlock = extractCssBlock(cssContent, ".tasknotes-plugin .nl-preview-container");
		const visibleBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin .nl-preview-container.nl-preview-container--visible"
		);

		expect(hiddenBlock).toContain("display: none;");
		expect(visibleBlock).toContain("display: block;");
		expect(cssContent.indexOf(visibleBlock)).toBeGreaterThan(cssContent.indexOf(hiddenBlock));
	});
});
