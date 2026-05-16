/* eslint-disable @typescript-eslint/no-non-null-assertion -- Timer helpers check active interval state before clearing handles. */
/**
 * Pomodoro Utility Functions
 */

import { PomodoroTimePeriod } from "../types";

type PomodoroSessionLike = {
	activePeriods?: PomodoroTimePeriod[];
	duration?: number;
	startTime?: string;
	endTime?: string;
};

/**
 * Backward compatibility helper for calculating duration
 * Can be used in stats calculations to handle both old and new formats
 */
export function getSessionDuration(session: PomodoroSessionLike): number {
	// New format: calculate from activePeriods
	if (session.activePeriods && Array.isArray(session.activePeriods)) {
		return session.activePeriods
			.filter((period: PomodoroTimePeriod) => period.endTime)
			.reduce((total: number, period: PomodoroTimePeriod) => {
				const start = new Date(period.startTime);
				const end = new Date(period.endTime!);
				const durationMs = end.getTime() - start.getTime();
				return total + Math.round(durationMs / (1000 * 60)); // minutes
			}, 0);
	}

	// Legacy format: use duration field
	if (session.duration !== undefined) {
		return session.duration;
	}

	// Fallback: calculate from start/end times
	if (session.startTime && session.endTime) {
		const start = new Date(session.startTime);
		const end = new Date(session.endTime);
		const durationMs = end.getTime() - start.getTime();
		return Math.round(durationMs / (1000 * 60)); // minutes
	}

	return 0;
}
