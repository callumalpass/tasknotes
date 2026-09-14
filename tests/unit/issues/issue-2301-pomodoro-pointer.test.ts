import fs from "fs";
import path from "path";

const css = fs.readFileSync(path.resolve(__dirname, "../../../styles/pomodoro-view.css"), "utf8");

function block(name: string): string {
	return css.match(new RegExp(`\\.tasknotes-plugin \\.pomodoro-view__${name}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("Issue #2301: Pomodoro duration pointer targets", () => {
	it.each(["timer-display", "timer-input"])("restores pointer targeting on %s", (name) => {
		expect(block(name)).toMatch(/pointer-events:\s*auto;/);
	});

	it("keeps the overlay click-through and adjustment buttons interactive", () => {
		expect(block("timer-overlay")).toMatch(/pointer-events:\s*none;/);
		expect(block("time-controls")).toMatch(/pointer-events:\s*auto;/);
	});
});
