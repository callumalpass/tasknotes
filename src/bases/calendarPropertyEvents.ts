import { format } from "date-fns";
import {
	formatDateForStorage,
	hasTimeComponent,
	parseDateToLocal,
	parseDateToUTC,
} from "../utils/dateUtils";

export type CalendarDateValue = {
	value: string | Date;
	isAllDay: boolean;
};

export type CalendarPropertyEventFile = {
	path: string;
	basename?: string;
	name?: string;
};

export type CalendarPropertyEvent = {
	id: string;
	title: string;
	start: string;
	end?: string;
	allDay: boolean;
	backgroundColor: string;
	borderColor: string;
	textColor: string;
	editable: boolean;
	extendedProps: {
		eventType: "property-based";
		filePath: string;
		file: CalendarPropertyEventFile;
		basesEntry: unknown;
	};
};

export type BuildCalendarPropertyEventInput<TEntry> = {
	entry: TEntry;
	file: CalendarPropertyEventFile | null | undefined;
	startDateProperty: string;
	endDateProperty?: string | null;
	titleProperty?: string | null;
	getPropertyValue: (entry: TEntry, propertyId: string) => unknown;
};

/**
 * Normalize date-like inputs to UTC-anchored strings for all-day values, or
 * to localized datetime strings for time-aware values.
 */
export function normalizeDateValueForCalendar(value: unknown): CalendarDateValue | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		const normalizedEmptyValue = trimmed.toLowerCase();
		if (!trimmed || normalizedEmptyValue === "null" || normalizedEmptyValue === "undefined") {
			return null;
		}

		if (hasTimeComponent(trimmed)) {
			const parsed = parseDateToLocal(trimmed);
			if (Number.isNaN(parsed.getTime())) return null;
			return { value: format(parsed, "yyyy-MM-dd'T'HH:mm"), isAllDay: false };
		}

		try {
			const anchored = parseDateToUTC(trimmed);
			return { value: formatDateForStorage(anchored), isAllDay: true };
		} catch {
			return null;
		}
	}

	if (typeof value === "number") {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return null;
		return { value: formatDateForStorage(date), isAllDay: true };
	}

	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		const hasTime =
			value.getHours() !== 0 ||
			value.getMinutes() !== 0 ||
			value.getSeconds() !== 0 ||
			value.getMilliseconds() !== 0;
		if (hasTime) {
			return { value: format(value, "yyyy-MM-dd'T'HH:mm"), isAllDay: false };
		}
		return { value: formatDateForStorage(value), isAllDay: true };
	}

	return null;
}

function formatCalendarDateValue(normalized: CalendarDateValue): string {
	return typeof normalized.value === "string"
		? normalized.value
		: format(normalized.value, "yyyy-MM-dd'T'HH:mm");
}

function getPropertyEventTitle<TEntry>(
	entry: TEntry,
	titleProperty: string | null | undefined,
	file: CalendarPropertyEventFile,
	getPropertyValue: (entry: TEntry, propertyId: string) => unknown
): string {
	if (titleProperty) {
		const titleValue = getPropertyValue(entry, titleProperty);
		if (typeof titleValue === "string" && titleValue.trim()) {
			return titleValue.trim();
		}
	}

	return file.basename || file.name || file.path;
}

export function buildCalendarPropertyEvent<TEntry>({
	entry,
	file,
	startDateProperty,
	endDateProperty,
	titleProperty,
	getPropertyValue,
}: BuildCalendarPropertyEventInput<TEntry>): CalendarPropertyEvent | null {
	if (!file) {
		return null;
	}

	const startNormalized = normalizeDateValueForCalendar(
		getPropertyValue(entry, startDateProperty)
	);
	if (!startNormalized) {
		return null;
	}

	const startDateStr = formatCalendarDateValue(startNormalized);

	let endDateStr: string | undefined;
	let isEndAllDay = startNormalized.isAllDay;
	if (endDateProperty) {
		const endNormalized = normalizeDateValueForCalendar(
			getPropertyValue(entry, endDateProperty)
		);
		if (endNormalized) {
			endDateStr = formatCalendarDateValue(endNormalized);
			isEndAllDay = endNormalized.isAllDay;
		}
	}

	return {
		id: `property-${file.path}`,
		title: getPropertyEventTitle(entry, titleProperty, file, getPropertyValue),
		start: startDateStr,
		end: endDateStr,
		allDay: startNormalized.isAllDay && (endDateStr ? isEndAllDay : true),
		backgroundColor: "var(--color-accent)",
		borderColor: "var(--color-accent)",
		textColor: "var(--text-on-accent)",
		editable: true,
		extendedProps: {
			eventType: "property-based",
			filePath: file.path,
			file,
			basesEntry: entry,
		},
	};
}
