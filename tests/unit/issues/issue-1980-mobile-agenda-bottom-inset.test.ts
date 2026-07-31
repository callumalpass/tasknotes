import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #1980: mobile Agenda bottom inset", () => {
	it("reserves mobile bottom-bar space inside list Agenda scrollers", () => {
		const css = readRepoFile("styles/advanced-calendar-view.css");

		expect(css).toMatch(
			/body\.is-mobile \.advanced-calendar-view\.advanced-calendar-view--list \.fc-scroller\s*\{[^}]*padding-bottom:\s*calc\(128px \+ env\(safe-area-inset-bottom,\s*0px\)\);[^}]*scroll-padding-bottom:\s*calc\(128px \+ env\(safe-area-inset-bottom,\s*0px\)\);/s
		);
	});
});
