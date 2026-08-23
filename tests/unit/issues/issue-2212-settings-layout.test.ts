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

describe("Issue #2212: settings layout in Obsidian settings modal", () => {
	it("stacks the TaskNotes toolbar and tab content despite Obsidian's setting-item flex layout", () => {
		const css = readRepoFile("styles/settings-view.css");

		const rootBlock = extractCssBlock(
			css,
			".modal.mod-settings .tasknotes-settings"
		);

		expect(rootBlock).toContain("box-sizing: border-box;");
		expect(rootBlock).toContain("display: block;");
		expect(css).not.toContain(".tasknotes-settings.vertical-tab-content");
	});

	it("keeps a compact desktop gutter around the TaskNotes settings view", () => {
		const css = readRepoFile("styles/settings-view.css");

		const desktopRootBlock = extractCssBlock(
			css,
			"body:not(.is-mobile) .modal.mod-settings .tasknotes-settings"
		);

		expect(desktopRootBlock).toContain("padding-inline: var(--size-4-8);");
	});

	it("left-aligns native SettingGroup sections beneath the TaskNotes tab bar", () => {
		const css = readRepoFile("styles/settings-view.css");

		const groupBlock = extractCssBlock(
			css,
			"body:not(.is-mobile) .modal.mod-settings .tasknotes-settings .settings-view__tab-content > .setting-group"
		);

		expect(groupBlock).toContain("margin-inline: 0;");
	});
});
