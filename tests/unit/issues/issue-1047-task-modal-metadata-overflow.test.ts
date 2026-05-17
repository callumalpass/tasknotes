/**
 * Issue #1047: long file paths in the Edit Task modal could force horizontal
 * scrolling on narrow mobile screens.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1047
 */

import * as fs from "fs";
import * as path from "path";

const cssFilePath = path.resolve(__dirname, "../../../styles/task-modal.css");

describe("Issue #1047: task modal metadata overflow", () => {
	it("allows long metadata values to wrap instead of widening the modal", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");
		const metadataItemBlock = extractCssBlock(cssContent, ".tasknotes-plugin .metadata-item");
		const metadataKeyBlock = extractCssBlock(cssContent, ".tasknotes-plugin .metadata-key");
		const metadataValueBlock = extractCssBlock(
			cssContent,
			".tasknotes-plugin .metadata-value"
		);

		expect(metadataItemBlock).toContain("min-width: 0");
		expect(metadataKeyBlock).toContain("flex: 0 0 auto");
		expect(metadataValueBlock).toContain("flex: 1 1 auto");
		expect(metadataValueBlock).toContain("min-width: 0");
		expect(metadataValueBlock).toContain("overflow-wrap: anywhere");
		expect(metadataValueBlock).toContain("white-space: normal");
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
