import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

describe("Issue #966: mobile reminder delete target", () => {
	it("gives reminder delete buttons a visible mobile touch target", () => {
		const css = readRepoFile("styles/reminder-modal.css");

		expect(css).toContain(
			"body.is-mobile .tasknotes-plugin .reminder-modal__action-btn"
		);
		expect(css).toContain("width: 44px");
		expect(css).toContain("height: 44px");
		expect(css).toContain("color: var(--text-error)");
		expect(css).toContain(
			"body.is-mobile .tasknotes-plugin .reminder-modal__action-btn svg"
		);
	});
});
