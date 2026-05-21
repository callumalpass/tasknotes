import fs from "fs";
import path from "path";
import { resolvePomodoroLayoutSize } from "../../../src/views/PomodoroView";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #1919 - Pomodoro resize feedback", () => {
	it("uses the Obsidian pane size instead of the mutable Pomodoro content size", () => {
		expect(
			resolvePomodoroLayoutSize(
				{ width: 320, height: 640 },
				{ width: 320, height: 428 }
			)
		).toEqual({ width: 320, height: 640 });
	});

	it("falls back to the Pomodoro content size before the pane reports dimensions", () => {
		expect(
			resolvePomodoroLayoutSize(
				{ width: 0, height: 0 },
				{ width: 320, height: 428 }
			)
		).toEqual({ width: 320, height: 428 });
	});

	it("observes the stable view content element rather than the resized Pomodoro element", () => {
		const source = readRepoFile("src/views/PomodoroView.ts");

		expect(source).toContain("this.resizeObserver.observe(this.contentEl);");
		expect(source).not.toContain("this.resizeObserver.observe(pomodoroContainer);");
	});

	it("keeps the Pomodoro root bounded to the current pane", () => {
		const css = readRepoFile("styles/pomodoro-view.css");
		const rootRule = css.match(/\.tasknotes-plugin\.pomodoro-view\s*\{[^}]*\}/)?.[0] ?? "";

		expect(rootRule).toContain("height: 100%;");
		expect(rootRule).toContain("min-height: 0;");
		expect(rootRule).toContain("overflow-y: auto;");
		expect(rootRule).not.toContain("min-height: 100vh");
		expect(css).toContain(".tasknotes-plugin.pomodoro-view--narrow");
	});
});
