import {
	calculatePomodoroStats,
	filterPomodoroSessionsByDate,
	filterPomodoroSessionsByDateRange,
	getPomodoroSessionDateKey,
	getPomodoroTimestampDateKey,
	getPomodoroDateKeysInRange,
	sortPomodoroSessions,
} from "../../../src/utils/pomodoroStats";
import { PomodoroSessionHistory } from "../../../src/types";

function session(overrides: Partial<PomodoroSessionHistory>): PomodoroSessionHistory {
	const startTime = overrides.startTime ?? "2026-04-26T09:00:00.000Z";
	const endTime = overrides.endTime ?? "2026-04-26T09:25:00.000Z";

	return {
		id: overrides.id ?? "session",
		startTime,
		endTime,
		plannedDuration: overrides.plannedDuration ?? 25,
		type: overrides.type ?? "work",
		completed: overrides.completed ?? true,
		taskPath: overrides.taskPath,
		activePeriods:
			overrides.activePeriods ??
			[
				{
					startTime,
					endTime,
				},
			],
	};
}

describe("pomodoroStats", () => {
	it("calculates work-session stats from sorted history without view/service duplication", () => {
		const sessions = [
			session({
				id: "latest-completed",
				startTime: "2026-04-26T12:00:00.000Z",
				endTime: "2026-04-26T12:25:00.000Z",
				completed: true,
			}),
			session({
				id: "oldest-completed",
				startTime: "2026-04-26T09:00:00.000Z",
				endTime: "2026-04-26T09:25:00.000Z",
				completed: true,
			}),
			session({
				id: "break-ignored",
				startTime: "2026-04-26T10:00:00.000Z",
				endTime: "2026-04-26T10:05:00.000Z",
				type: "short-break",
				completed: true,
			}),
			session({
				id: "interrupted",
				startTime: "2026-04-26T11:00:00.000Z",
				endTime: "2026-04-26T11:10:00.000Z",
				completed: false,
			}),
		];

		expect(calculatePomodoroStats(sessions)).toEqual({
			pomodorosCompleted: 2,
			currentStreak: 1,
			totalMinutes: 50,
			averageSessionLength: 25,
			completionRate: 67,
		});
	});

	it("filters sessions by UTC storage date and inclusive date ranges", () => {
		const sessions = [
			session({ id: "before", startTime: "2026-04-24T23:00:00.000Z" }),
			session({ id: "start", startTime: "2026-04-25T09:00:00.000Z" }),
			session({ id: "end", startTime: "2026-04-26T09:00:00.000Z" }),
			session({ id: "after", startTime: "2026-04-27T09:00:00.000Z" }),
		];

		expect(
			filterPomodoroSessionsByDate(
				sessions,
				new Date(Date.UTC(2026, 3, 26))
			).map((item) => item.id)
		).toEqual(["end"]);
		expect(
			filterPomodoroSessionsByDateRange(
				sessions,
				new Date(Date.UTC(2026, 3, 25)),
				new Date(Date.UTC(2026, 3, 26))
			).map((item) => item.id)
		).toEqual(["start", "end"]);
		expect(
			getPomodoroDateKeysInRange(
				new Date(Date.UTC(2026, 3, 25)),
				new Date(Date.UTC(2026, 3, 27))
			)
		).toEqual(["2026-04-25", "2026-04-26", "2026-04-27"]);
	});

	it("uses the recorded Pomodoro timestamp date instead of shifting through UTC", () => {
		const eveningSession = session({
			startTime: "2026-04-02T21:09:25.755-04:00",
			endTime: "2026-04-02T21:34:25.755-04:00",
		});

		expect(getPomodoroSessionDateKey(eveningSession)).toBe("2026-04-02");
		expect(
			filterPomodoroSessionsByDate(
				[eveningSession],
				new Date(Date.UTC(2026, 3, 2))
			).map((item) => item.id)
		).toEqual(["session"]);
		expect(
			filterPomodoroSessionsByDate(
				[eveningSession],
				new Date(Date.UTC(2026, 3, 3))
			).map((item) => item.id)
		).toEqual([]);
	});

	it("keeps stored Pomodoro timestamp dates stable across reader timezones", () => {
		const originalTimezone = process.env.TZ;

		try {
			for (const timezone of ["America/New_York", "Asia/Tokyo", "Europe/London"]) {
				process.env.TZ = timezone;
				expect(getPomodoroTimestampDateKey("2026-04-02T21:09:25.755-04:00")).toBe(
					"2026-04-02"
				);
			}
		} finally {
			if (originalTimezone) {
				process.env.TZ = originalTimezone;
			} else {
				delete process.env.TZ;
			}
		}
	});

	it("falls back to UTC storage dates for legacy non-ISO timestamp values", () => {
		expect(getPomodoroTimestampDateKey("April 2, 2026 21:09:25 GMT-0400")).toBe(
			"2026-04-03"
		);
		expect(getPomodoroTimestampDateKey("not a timestamp")).toBe("");
	});

	it("sorts sessions without mutating the input array", () => {
		const sessions = [
			session({ id: "second", startTime: "2026-04-26T10:00:00.000Z" }),
			session({ id: "first", startTime: "2026-04-26T09:00:00.000Z" }),
		];

		expect(sortPomodoroSessions(sessions).map((item) => item.id)).toEqual([
			"first",
			"second",
		]);
		expect(sessions.map((item) => item.id)).toEqual(["second", "first"]);
	});
});
