import fs from "fs";
import path from "path";

function readPomodoroCss(): string {
	return fs.readFileSync(
		path.resolve(__dirname, "../../../styles/pomodoro-view.css"),
		"utf8"
	);
}

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	return match?.[1] ?? "";
}

describe("Issue #1957: Pomodoro vertical split layout", () => {
	it("avoids unsafe vertical centering when the Pomodoro pane overflows", () => {
		const css = readPomodoroCss();
		const rootBlock = extractCssBlock(css, ".tasknotes-plugin.pomodoro-view");
		const timerSectionBlock = extractCssBlock(
			css,
			".tasknotes-plugin.pomodoro-view > .pomodoro-view__timer-section"
		);
		const statsSectionBlock = extractCssBlock(
			css,
			".tasknotes-plugin.pomodoro-view > .pomodoro-view__stats-section"
		);

		expect(rootBlock).toContain("justify-content: flex-start;");
		expect(rootBlock).not.toContain("justify-content: center;");
		expect(timerSectionBlock).toContain("margin-top: auto;");
		expect(statsSectionBlock).toContain("margin-bottom: auto;");
	});
});
