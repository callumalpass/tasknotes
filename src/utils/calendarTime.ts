export const CALENDAR_END_TIME_MAX_HOUR = 48;

export type CalendarTimeValidationOptions = {
	maxHour?: number;
	allowMaxHourOnlyAtZero?: boolean;
};

export type CalendarTimeValidationResult = {
	value: string;
	isValid: boolean;
};

export function normalizeCalendarTimeValue(
	value: string | undefined,
	defaultValue: string,
	options: CalendarTimeValidationOptions = {}
): CalendarTimeValidationResult {
	if (!value) {
		return { value: defaultValue, isValid: true };
	}

	const match = /^(\d{2}):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
	if (!match) {
		return { value: defaultValue, isValid: false };
	}

	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	const seconds = Number(match[3] ?? "00");
	const maxHour = options.maxHour ?? 23;

	if (hours < 0 || hours > maxHour) {
		return { value: defaultValue, isValid: false };
	}

	if (
		options.allowMaxHourOnlyAtZero &&
		hours === maxHour &&
		(minutes !== 0 || seconds !== 0)
	) {
		return { value: defaultValue, isValid: false };
	}

	return {
		value: `${match[1]}:${match[2]}:${match[3] ?? "00"}`,
		isValid: true,
	};
}
