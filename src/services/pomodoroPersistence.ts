import type { PomodoroState } from "../types";

interface PomodoroPersistenceData {
	pomodoroState?: unknown;
	lastPomodoroDate?: unknown;
	lastSelectedTaskPath?: unknown;
}

function hasOwnKey(value: unknown, key: string): boolean {
	return (
		value !== null &&
		typeof value === "object" &&
		Object.prototype.hasOwnProperty.call(value, key)
	);
}

function jsonEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

export function shouldPersistPomodoroState(
	data: PomodoroPersistenceData | null | undefined,
	state: PomodoroState,
	dateKey: string
): boolean {
	return !jsonEqual(data?.pomodoroState, state) || data?.lastPomodoroDate !== dateKey;
}

export function shouldPersistLastSelectedTask(
	data: PomodoroPersistenceData | null | undefined,
	taskPath: string | undefined
): boolean {
	if (taskPath === undefined) {
		return hasOwnKey(data, "lastSelectedTaskPath");
	}

	return data?.lastSelectedTaskPath !== taskPath;
}
