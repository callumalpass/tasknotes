import { readFileSync } from "fs";
import path from "path";

describe("Issue #1524: pop-out task card typography", () => {
	it("uses absolute font-size tokens so Obsidian pop-out root font sizes do not shrink task cards", () => {
		const variablesCss = readFileSync(
			path.join(process.cwd(), "styles", "variables.css"),
			"utf8"
		);

		expect(variablesCss).toContain("--cs-text-body-large: 14px;");
		expect(variablesCss).toContain("--cs-text-body-medium: 12px;");
		expect(variablesCss).toContain("--cs-text-label-medium: 11px;");
		expect(variablesCss).toContain("--cs-text-title-medium: 14px;");
		expect(variablesCss).not.toContain("--cs-text-body-large: 0.875rem;");
	});
});
