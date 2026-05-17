import fs from "fs";
import path from "path";

function getStyleFiles(): string[] {
	const stylesDir = path.resolve(__dirname, "../../../styles");
	return fs
		.readdirSync(stylesDir)
		.filter((file) => file.endsWith(".css"))
		.map((file) => path.join(stylesDir, file));
}

describe("Issue #1470: interactive cursor fallback", () => {
	it("uses Obsidian's clickable cursor variable for interactive TaskNotes CSS", () => {
		const staleCursorReferences: string[] = [];
		let clickableCursorReferences = 0;

		for (const filePath of getStyleFiles()) {
			const css = fs.readFileSync(filePath, "utf8");
			if (css.includes("var(--cursor, pointer)")) {
				staleCursorReferences.push(path.basename(filePath));
			}
			clickableCursorReferences += css.match(/var\(--cursor-link, pointer\)/g)?.length ?? 0;
		}

		expect(staleCursorReferences).toEqual([]);
		expect(clickableCursorReferences).toBeGreaterThan(50);
	});
});
