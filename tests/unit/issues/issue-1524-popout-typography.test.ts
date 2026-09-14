import { readFileSync } from "fs";
import path from "path";

describe("Issue #1524: pop-out task card typography", () => {
	it("uses Obsidian font-size tokens without root-relative units that shrink pop-out task cards", () => {
		const variablesCss = readFileSync(
			path.join(process.cwd(), "styles", "variables.css"),
			"utf8"
		);

		const fontSizes = [...variablesCss.matchAll(/--tn-font-size-[\w-]+:\s*([^;]+);/g)];
		expect(fontSizes).toHaveLength(7);
		expect(variablesCss).toContain("--tn-font-size-base: var(--font-text-size, 16px);");
		for (const [, value] of fontSizes) {
			expect(value).not.toMatch(/\d(?:rem|em)\b/);
			expect(value).toMatch(/var\(--(?:tn-font-size-base|font-text-size)/);
		}
	});
});
