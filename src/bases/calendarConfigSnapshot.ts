export type CalendarViewConfigReader = {
	get(key: string): unknown;
};

const CALENDAR_CONFIG_SNAPSHOT_KEYS = [
	// Event toggles
	"showScheduled",
	"showDue",
	"showScheduledToDueSpan",
	"showRecurring",
	"showCompletedRecurringInstances",
	"showSkippedRecurringInstances",
	"showTimeEntries",
	"showTimeblocks",
	"showPropertyBasedEvents",
	// Layout options
	"calendarView",
	"heightMode",
	"customDayCount",
	"listDayCount",
	"slotMinTime",
	"slotMaxTime",
	"slotDuration",
	"snapDuration",
	"firstDay",
	"weekNumbers",
	"nowIndicator",
	"showWeekends",
	"showAllDaySlot",
	"showTimeGrid",
	"showTodayHighlight",
	"todayColumnWidthMultiplier",
	"selectMirror",
	"timeFormat",
	"scrollTime",
	"eventMinHeight",
	"slotEventOverlap",
	"eventMaxStack",
	"dayMaxEvents",
	"dayMaxEventRows",
	// Property-based events
	"startDateProperty",
	"endDateProperty",
	"titleProperty",
	// Date navigation
	"initialDate",
	"initialDateProperty",
	"initialDateStrategy",
	"createDailyNotesFromDateLinks",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeProviderIds(ids: readonly unknown[] | undefined): string[] {
	const normalized: string[] = [];

	for (const id of ids ?? []) {
		if (typeof id !== "string") {
			continue;
		}

		const trimmed = id.trim();
		if (trimmed) {
			normalized.push(trimmed);
		}
	}

	return normalized.sort();
}

export function readCalendarConfigValue(
	config: CalendarViewConfigReader | undefined,
	key: string
): unknown {
	if (!config || typeof config.get !== "function") {
		return undefined;
	}

	const directValue = config.get(key);
	if (directValue !== null && directValue !== undefined) {
		return directValue;
	}

	const options = config.get("options");
	if (!isRecord(options)) {
		return undefined;
	}

	return options[key];
}

export function getCalendarConfigValue<T>(
	config: CalendarViewConfigReader | undefined,
	key: string,
	fallback: T
): T {
	const value = readCalendarConfigValue(config, key);
	return value === null || value === undefined ? fallback : (value as T);
}

export function getCalendarConfigSnapshotKeys(options: {
	icsCalendarIds?: readonly unknown[];
	googleCalendarIds?: readonly unknown[];
	microsoftCalendarIds?: readonly unknown[];
} = {}): string[] {
	return [
		...CALENDAR_CONFIG_SNAPSHOT_KEYS,
		...normalizeProviderIds(options.icsCalendarIds).map((id) => `showICS_${id}`),
		...normalizeProviderIds(options.googleCalendarIds).map(
			(id) => `showGoogleCalendar_${id}`
		),
		...normalizeProviderIds(options.microsoftCalendarIds).map(
			(id) => `showMicrosoftCalendar_${id}`
		),
	];
}

export function buildCalendarConfigSnapshot(options: {
	config: CalendarViewConfigReader | undefined;
	icsCalendarIds?: readonly unknown[];
	googleCalendarIds?: readonly unknown[];
	microsoftCalendarIds?: readonly unknown[];
}): string {
	if (!options.config || typeof options.config.get !== "function") {
		return "";
	}

	const keys = getCalendarConfigSnapshotKeys({
		icsCalendarIds: options.icsCalendarIds,
		googleCalendarIds: options.googleCalendarIds,
		microsoftCalendarIds: options.microsoftCalendarIds,
	});

	return JSON.stringify(keys.map((key) => readCalendarConfigValue(options.config, key)));
}
