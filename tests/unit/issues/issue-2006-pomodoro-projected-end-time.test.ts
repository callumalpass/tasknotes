import { msg } from "@lingui/core/macro";
import fs from "fs";
import path from "path";
import { englishText } from "../../helpers/real-i18n";
import { getProjectedPomodoroEndTimeMs } from "../../../src/utils/pomodoroTime";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #2006: Pomodoro projected end time", () => {
	it("derives a projected end timestamp from the current remaining duration", () => {
		const now = Date.parse("2026-06-08T11:43:25.000Z");

		expect(getProjectedPomodoroEndTimeMs(18 * 60 + 35, now)).toBe(
			Date.parse("2026-06-08T12:02:00.000Z")
		);
	});

	it("renders the running meta with a finish-time placeholder", () => {
		expect(englishText(msg({ message: "{time} left · Ends at {endTime}", context: "views.pomodoro.meta.running" }), { time: "1:00", endTime: "12:02" })).toBe("1:00 left · Ends at 12:02");

		const source = readRepoFile("src/views/PomodoroView.ts");
		expect(source).toContain("getProjectedPomodoroEndTimeMs(state.timeRemaining, nowMs)");
		expect(source).toContain('context: "views.pomodoro.meta.running"');
	});

	it("refreshes session metadata after timer duration adjustments", () => {
		const source = readRepoFile("src/views/PomodoroView.ts");
		const adjustSessionTimeBody =
			source.match(/private adjustSessionTime\(seconds: number\)[\s\S]*?\n\t}\n/)?.[0] ?? "";

		expect(adjustSessionTimeBody).toContain("this.updateDisplay();");
	});
});
