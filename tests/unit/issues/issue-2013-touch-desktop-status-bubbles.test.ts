import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function extractMediaBlock(css: string, mediaQuery: string): string {
	const start = css.indexOf(mediaQuery);
	expect(start).toBeGreaterThanOrEqual(0);

	const openBrace = css.indexOf("{", start);
	let depth = 0;
	for (let index = openBrace; index < css.length; index++) {
		const character = css[index];
		if (character === "{") {
			depth++;
		} else if (character === "}") {
			depth--;
			if (depth === 0) {
				return css.slice(openBrace + 1, index);
			}
		}
	}

	throw new Error(`Could not extract media block for ${mediaQuery}`);
}

describe("Issue #2013: touch-capable desktop task-card indicators", () => {
	it("does not enlarge default card status and priority dots for non-mobile coarse-pointer desktops", () => {
		const css = readRepoFile("styles/task-card-bem.css");
		const defaultCoarsePointerBlock = extractMediaBlock(css, "@media (pointer: coarse)");

		expect(defaultCoarsePointerBlock).toContain(
			"body:not(.is-mobile) .tasknotes-plugin .task-card__context-menu"
		);
		expect(defaultCoarsePointerBlock).not.toContain(
			"body:not(.is-mobile) .tasknotes-plugin .task-card__status-dot"
		);
		expect(defaultCoarsePointerBlock).not.toContain(
			"body:not(.is-mobile) .tasknotes-plugin .task-card__priority-dot"
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__status-dot\s*\{[^}]*width:\s*var\(--tn-mobile-task-card-indicator-size\);[^}]*height:\s*var\(--tn-mobile-task-card-indicator-size\);/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__priority-dot\s*\{[^}]*width:\s*var\(--tn-mobile-task-card-indicator-size\);[^}]*height:\s*var\(--tn-mobile-task-card-indicator-size\);/s
		);
	});
});
