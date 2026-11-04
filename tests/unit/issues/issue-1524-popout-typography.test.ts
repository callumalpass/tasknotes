import { readFileSync } from "fs";
import path from "path";

describe("Issue #1524: pop-out task card typography", () => {
	it("uses absolute font-size tokens so Obsidian pop-out root font sizes do not shrink task cards", () => {
		const variablesCss = readFileSync(
			path.join(process.cwd(), "styles", "tokens.css"),
			"utf8"
		);

		expect(variablesCss).toContain("--tn-type-md: calc(var(--tn-type-base) * 0.875);");
		expect(variablesCss).toContain("--tn-type-xs: calc(var(--tn-type-base) * 0.75);");
		expect(variablesCss).toContain("--tn-type-2xs: calc(var(--tn-type-base) * 0.6875);");
		expect(variablesCss).toContain("--tn-type-base: var(--font-text-size, 16px);");
		expect(variablesCss).not.toContain("--tn-type-base: 0.875rem;");
	});
});
