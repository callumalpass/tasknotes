import {
	formatPomodoroTime,
	getActiveElapsedSeconds,
	getSessionCompletionTimeMs,
	getSessionProgressRatio,
	getSessionRemainingSeconds,
	parsePomodoroDurationInput,
} from "../../../src/utils/pomodoroTime";
import type { PomodoroSession } from "../../../src/types";

function session(overrides: Partial<PomodoroSession> = {}): PomodoroSession {
	return {
		id: "session",
		startTime: "2026-05-16T09:00:00.000Z",
		plannedDuration: 25,
		type: "work",
		completed: false,
		activePeriods: [
			{
				startTime: "2026-05-16T09:00:00.000Z",
			},
		],
		...overrides,
	};
}

describe("pomodoroTime", () => {
	it("formats durations with an hour column only when needed", () => {
		expect(formatPomodoroTime(25 * 60)).toBe("25:00");
		expect(formatPomodoroTime(5 * 60)).toBe("05:00");
		expect(formatPomodoroTime(90 * 60)).toBe("1:30:00");
		expect(formatPomodoroTime(5 * 60, { padMinutes: false })).toBe("5:00");
	});

	it("parses plain minutes, minute-second, and hour-minute-second input", () => {
		expect(parsePomodoroDurationInput("10")).toBe(10 * 60);
		expect(parsePomodoroDurationInput("10:30")).toBe(10 * 60 + 30);
		expect(parsePomodoroDurationInput("1:30:00")).toBe(90 * 60);
		expect(parsePomodoroDurationInput("00:00")).toBeNull();
		expect(parsePomodoroDurationInput("10:99")).toBeNull();
		expect(parsePomodoroDurationInput("1:70:00")).toBeNull();
		expect(parsePomodoroDurationInput("later")).toBeNull();
	});

	it("derives remaining time and progress from active periods and wall clock", () => {
		const current = session({
			plannedDuration: 30,
			activePeriods: [
				{
					startTime: "2026-05-16T09:00:00.000Z",
					endTime: "2026-05-16T09:10:00.000Z",
				},
				{
					startTime: "2026-05-16T09:20:00.000Z",
				},
			],
		});
		const now = Date.parse("2026-05-16T09:25:00.000Z");

		expect(getActiveElapsedSeconds(current, now)).toBe(15 * 60);
		expect(getSessionRemainingSeconds(current, now)).toBe(15 * 60);
		expect(getSessionProgressRatio(current, now)).toBe(0.5);
	});

	it("caps completion at the planned end instead of a late wake time", () => {
		const current = session({
			plannedDuration: 25,
			activePeriods: [
				{
					startTime: "2026-05-16T09:00:00.000Z",
				},
			],
		});
		const lateWake = Date.parse("2026-05-16T10:00:00.000Z");

		expect(getSessionRemainingSeconds(current, lateWake)).toBe(0);
		expect(getSessionCompletionTimeMs(current, lateWake)).toBe(
			Date.parse("2026-05-16T09:25:00.000Z")
		);
	});
});
