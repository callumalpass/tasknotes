import fs from "fs";
import path from "path";
import { en } from "../../../src/i18n/resources/en";
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
		expect(en.views.pomodoro.meta.running).toBe("{time} left · Ends at {endTime}");

		const source = readRepoFile("src/views/PomodoroView.ts");
		expect(source).toContain("getProjectedPomodoroEndTimeMs(state.timeRemaining)");
		expect(source).toContain("views.pomodoro.meta.running");
	});

	it("refreshes session metadata after timer duration adjustments", () => {
		const source = readRepoFile("src/views/PomodoroView.ts");
		const adjustSessionTimeBody =
			source.match(/private adjustSessionTime\(seconds: number\)[\s\S]*?\n\t}\n/)?.[0] ??
			"";

		expect(adjustSessionTimeBody).toContain("this.updateSessionMeta(updatedState);");
	});
});
