import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function extractCssBlock(css: string, selector: string): string {
	const index = css.indexOf(selector);
	if (index === -1) {
		return "";
	}

	const blockStart = css.indexOf("{", index);
	if (blockStart === -1) {
		return "";
	}

	let depth = 0;
	for (let i = blockStart; i < css.length; i += 1) {
		if (css[i] === "{") {
			depth += 1;
		} else if (css[i] === "}") {
			depth -= 1;
			if (depth === 0) {
				return css.slice(blockStart + 1, i);
			}
		}
	}

	return "";
}

describe("Issue #2222: settings integrations tab visibility", () => {
	it("wraps the settings toolbar instead of clipping the final TaskNotes tab", () => {
		const css = readRepoFile("styles/settings-view.css");
		const toolbarBlock = extractCssBlock(
			css,
			".tasknotes-plugin .settings-view__toolbar"
		);
		const tabNavBlock = extractCssBlock(
			css,
			".tasknotes-plugin .settings-view__tab-nav"
		);

		expect(toolbarBlock).toContain("flex-wrap: wrap;");
		expect(tabNavBlock).toContain("flex-wrap: wrap;");
		expect(tabNavBlock).toContain("overflow: visible;");
		expect(tabNavBlock).not.toContain("overflow-x: auto;");
	});

	it("keeps the documentation link pinned right while the toolbar wraps", () => {
		const css = readRepoFile("styles/settings-view.css");
		const headerBlock = extractCssBlock(css, ".tasknotes-plugin .settings-header");

		expect(headerBlock).toContain("margin-inline-start: auto;");
	});
});
