import { PomodoroHistoryStats, PomodoroSessionHistory } from "../types";
import { formatDateForStorage } from "./dateUtils";
import { getSessionDuration } from "./pomodoroUtils";

export function sortPomodoroSessions(
	sessions: PomodoroSessionHistory[]
): PomodoroSessionHistory[] {
	return [...sessions].sort(
		(a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
	);
}

export function getPomodoroSessionDateKey(session: PomodoroSessionHistory): string {
	const date = new Date(session.startTime);

	if (isNaN(date.getTime())) {
		return "";
	}

	return formatDateForStorage(date);
}

export function filterPomodoroSessionsByDateKey(
	sessions: PomodoroSessionHistory[],
	dateKey: string
): PomodoroSessionHistory[] {
	if (!dateKey) {
		return [];
	}

	return sessions.filter((session) => getPomodoroSessionDateKey(session) === dateKey);
}

export function filterPomodoroSessionsByDate(
	sessions: PomodoroSessionHistory[],
	date: Date
): PomodoroSessionHistory[] {
	return filterPomodoroSessionsByDateKey(sessions, formatDateForStorage(date));
}

export function filterPomodoroSessionsByDateRange(
	sessions: PomodoroSessionHistory[],
	startDate: Date,
	endDate: Date
): PomodoroSessionHistory[] {
	const startKey = formatDateForStorage(startDate);
	const endKey = formatDateForStorage(endDate);

	if (!startKey || !endKey) {
		return [];
	}

	const [rangeStart, rangeEnd] = startKey <= endKey ? [startKey, endKey] : [endKey, startKey];

	return sessions.filter((session) => {
		const sessionKey = getPomodoroSessionDateKey(session);
		return sessionKey >= rangeStart && sessionKey <= rangeEnd;
	});
}

export function getPomodoroDateKeysInRange(startDate: Date, endDate: Date): string[] {
	const startKey = formatDateForStorage(startDate);
	const endKey = formatDateForStorage(endDate);

	if (!startKey || !endKey) {
		return [];
	}

	const [rangeStart, rangeEnd] = startKey <= endKey ? [startKey, endKey] : [endKey, startKey];
	const [startYear, startMonth, startDay] = rangeStart.split("-").map(Number);
	const [endYear, endMonth, endDay] = rangeEnd.split("-").map(Number);
	const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
	const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
	const dateKeys: string[] = [];

	while (current <= end) {
		dateKeys.push(formatDateForStorage(current));
		current.setUTCDate(current.getUTCDate() + 1);
	}

	return dateKeys;
}

export function calculatePomodoroStats(
	sessions: PomodoroSessionHistory[]
): PomodoroHistoryStats {
	const workSessions = sortPomodoroSessions(sessions).filter(
		(session) => session.type === "work"
	);
	const completedWork = workSessions.filter((session) => session.completed);

	let currentStreak = 0;
	for (let i = workSessions.length - 1; i >= 0; i--) {
		if (workSessions[i].completed) {
			currentStreak++;
		} else {
			break;
		}
	}

	const totalMinutes = completedWork.reduce(
		(sum, session) => sum + getSessionDuration(session),
		0
	);
	const averageSessionLength =
		completedWork.length > 0 ? totalMinutes / completedWork.length : 0;
	const completionRate =
		workSessions.length > 0 ? (completedWork.length / workSessions.length) * 100 : 0;

	return {
		pomodorosCompleted: completedWork.length,
		currentStreak,
		totalMinutes,
		averageSessionLength: Math.round(averageSessionLength),
		completionRate: Math.round(completionRate),
	};
}
