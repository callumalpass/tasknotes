import { describe, expect, it } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("issue 1774 - mobile project chevron target", () => {
	it("keeps expandable project chevrons visible and larger on mobile", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toContain("body.is-mobile .tasknotes-plugin .task-card__chevron");
		expect(css).toContain("opacity: 1;");
		expect(css).toContain("width: 32px;");
		expect(css).toContain("height: 32px;");
		expect(css).toContain(
			"body.is-mobile .tasknotes-plugin .task-card.task-card--chevron-left .task-card__chevron"
		);
	});
});
