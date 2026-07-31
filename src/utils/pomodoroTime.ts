import type { PomodoroSession } from "../types";

export const MAX_POMODORO_DURATION_SECONDS = 120 * 60;

function parseTimestampMs(value: string | undefined): number | null {
	if (!value) {
		return null;
	}

	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : null;
}

export function clampPomodoroDurationSeconds(seconds: number): number {
	if (!Number.isFinite(seconds)) {
		return 60;
	}

	return Math.max(1, Math.min(MAX_POMODORO_DURATION_SECONDS, Math.floor(seconds)));
}

export function getSessionDurationSeconds(session: PomodoroSession): number {
	return clampPomodoroDurationSeconds(session.plannedDuration * 60);
}

export function getActiveElapsedSeconds(session: PomodoroSession, nowMs = Date.now()): number {
	return (session.activePeriods ?? []).reduce((total, period) => {
		const startMs = parseTimestampMs(period.startTime);
		if (startMs === null) {
			return total;
		}

		const endMs = parseTimestampMs(period.endTime) ?? nowMs;
		const durationMs = Math.max(0, endMs - startMs);
		return total + Math.floor(durationMs / 1000);
	}, 0);
}

export function getSessionRemainingSeconds(session: PomodoroSession, nowMs = Date.now()): number {
	const durationSeconds = getSessionDurationSeconds(session);
	const elapsedSeconds = getActiveElapsedSeconds(session, nowMs);
	return Math.max(0, durationSeconds - elapsedSeconds);
}

export function getSessionProgressRatio(session: PomodoroSession, nowMs = Date.now()): number {
	const durationSeconds = getSessionDurationSeconds(session);
	if (durationSeconds <= 0) {
		return 0;
	}

	const elapsedSeconds = getActiveElapsedSeconds(session, nowMs);
	return Math.max(0, Math.min(1, elapsedSeconds / durationSeconds));
}

export function getProjectedPomodoroEndTimeMs(
	timeRemainingSeconds: number,
	nowMs = Date.now()
): number {
	const remainingSeconds = Number.isFinite(timeRemainingSeconds)
		? Math.max(0, Math.floor(timeRemainingSeconds))
		: 0;
	return nowMs + remainingSeconds * 1000;
}

export function getSessionCompletionTimeMs(
	session: PomodoroSession,
	nowMs = Date.now()
): number | null {
	let remainingMs = getSessionDurationSeconds(session) * 1000;

	for (const period of session.activePeriods ?? []) {
		const startMs = parseTimestampMs(period.startTime);
		if (startMs === null) {
			continue;
		}

		const endMs = parseTimestampMs(period.endTime) ?? nowMs;
		const periodDurationMs = Math.max(0, endMs - startMs);
		if (periodDurationMs >= remainingMs) {
			return startMs + remainingMs;
		}

		remainingMs -= periodDurationMs;
	}

	return null;
}

export function formatLocalTimestamp(timestampMs: number): string {
	const date = new Date(timestampMs);
	const timezoneOffset = -date.getTimezoneOffset();
	const sign = timezoneOffset >= 0 ? "+" : "-";
	const pad = (value: number, width = 2) => String(Math.abs(value)).padStart(width, "0");

	const offsetHours = pad(Math.floor(Math.abs(timezoneOffset) / 60));
	const offsetMinutes = pad(Math.abs(timezoneOffset) % 60);

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
		date.getHours()
	)}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${sign}${offsetHours}:${offsetMinutes}`;
}

export function formatPomodoroTime(
	seconds: number,
	options: { padMinutes?: boolean } = {}
): string {
	const validSeconds = Math.max(0, Math.floor(seconds));
	const totalMinutes = Math.floor(validSeconds / 60);
	const displaySeconds = validSeconds % 60;
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	const padMinutes = options.padMinutes ?? true;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${displaySeconds
			.toString()
			.padStart(2, "0")}`;
	}

	const minuteText = padMinutes
		? totalMinutes.toString().padStart(2, "0")
		: totalMinutes.toString();
	return `${minuteText}:${displaySeconds.toString().padStart(2, "0")}`;
}

export function parsePomodoroDurationInput(input: string): number | null {
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	const parts = trimmed.split(":");
	if (parts.length < 1 || parts.length > 3) {
		return null;
	}

	if (!parts.every((part) => /^\d+$/.test(part))) {
		return null;
	}

	const values = parts.map((part) => Number(part));
	if (values.some((value) => !Number.isSafeInteger(value))) {
		return null;
	}

	let totalSeconds: number;
	if (values.length === 1) {
		totalSeconds = values[0] * 60;
	} else if (values.length === 2) {
		const [minutes, seconds] = values;
		if (seconds > 59) {
			return null;
		}
		totalSeconds = minutes * 60 + seconds;
	} else {
		const [hours, minutes, seconds] = values;
		if (minutes > 59 || seconds > 59) {
			return null;
		}
		totalSeconds = hours * 3600 + minutes * 60 + seconds;
	}

	if (totalSeconds <= 0) {
		return null;
	}

	return clampPomodoroDurationSeconds(totalSeconds);
}
