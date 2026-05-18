import type { FieldMappingKey } from "../types";

const CALENDAR_DATA_SIGNATURE_FIELDS: FieldMappingKey[] = [
	"title",
	"status",
	"priority",
	"due",
	"scheduled",
	"contexts",
	"projects",
	"timeEstimate",
	"completedDate",
	"recurrence",
	"recurrenceAnchor",
	"timeEntries",
	"completeInstances",
	"skippedInstances",
	"blockedBy",
	"icsEventId",
	"googleCalendarEventId",
	"reminders",
	"sortOrder",
];

const CALENDAR_DATA_SIGNATURE_DEFAULT_FIELDS: Partial<Record<FieldMappingKey, string>> = {
	completeInstances: "complete_instances",
	recurrenceAnchor: "recurrence_anchor",
	skippedInstances: "skipped_instances",
};

type CalendarSignatureDataItem = {
	path?: string;
	properties?: Record<string, unknown>;
	frontmatter?: Record<string, unknown>;
};

type CalendarFallbackEntry = {
	file?: {
		path?: string;
	};
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stripBasesPropertyPrefix(propertyId: string): string {
	const parts = propertyId.split(".");
	if (parts.length > 1 && ["note", "file", "formula"].includes(parts[0])) {
		return parts.slice(1).join(".");
	}
	return propertyId;
}

export function getCalendarSignaturePropertyValue(
	properties: Record<string, unknown>,
	propertyId: string
): unknown {
	if (Object.prototype.hasOwnProperty.call(properties, propertyId)) {
		return properties[propertyId];
	}

	const strippedPropertyId = stripBasesPropertyPrefix(propertyId);
	if (
		strippedPropertyId !== propertyId &&
		Object.prototype.hasOwnProperty.call(properties, strippedPropertyId)
	) {
		return properties[strippedPropertyId];
	}

	return null;
}

export function normalizeCalendarSignatureValue(
	value: unknown,
	seen = new WeakSet<object>()
): unknown {
	if (value === undefined || typeof value === "function" || typeof value === "symbol") {
		return null;
	}

	if (typeof value === "bigint") {
		return value.toString();
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeCalendarSignatureValue(item, seen));
	}

	if (isRecord(value)) {
		if (seen.has(value)) {
			return "[Circular]";
		}
		seen.add(value);

		return Object.keys(value)
			.sort()
			.reduce<Record<string, unknown>>((normalized, key) => {
				normalized[key] = normalizeCalendarSignatureValue(value[key], seen);
				return normalized;
			}, {});
	}

	return value;
}

export function buildCalendarDataSignaturePropertyIds(options: {
	mapField: (field: FieldMappingKey) => string | null | undefined;
	visiblePropertyIds?: readonly unknown[];
	showPropertyBasedEvents: boolean;
	startDateProperty?: unknown;
	endDateProperty?: unknown;
	titleProperty?: unknown;
}): string[] {
	const propertyIds = new Set<string>();
	const addPropertyId = (propertyId: unknown) => {
		if (typeof propertyId !== "string") return;
		const trimmed = propertyId.trim();
		if (trimmed) propertyIds.add(trimmed);
	};

	for (const field of CALENDAR_DATA_SIGNATURE_FIELDS) {
		addPropertyId(
			options.mapField(field) ?? CALENDAR_DATA_SIGNATURE_DEFAULT_FIELDS[field] ?? field
		);
	}
	addPropertyId("tags");
	addPropertyId("archived");

	for (const propertyId of options.visiblePropertyIds ?? []) {
		addPropertyId(propertyId);
	}

	if (options.showPropertyBasedEvents) {
		addPropertyId(options.startDateProperty);
		addPropertyId(options.endDateProperty);
		addPropertyId(options.titleProperty);
	}

	return Array.from(propertyIds);
}

export function buildCalendarDataSignature(
	dataItems: readonly CalendarSignatureDataItem[],
	propertyIds: readonly string[]
): string {
	const rows = dataItems.map((item) => {
		const properties = item.properties || item.frontmatter || {};
		const values = propertyIds.map((propertyId) => [
			propertyId,
			normalizeCalendarSignatureValue(
				getCalendarSignaturePropertyValue(properties, propertyId)
			),
		]);

		return {
			path: item.path || "",
			values,
		};
	});

	return JSON.stringify({ propertyIds, rows });
}

export function buildCalendarFallbackDataSignature(
	entries: readonly CalendarFallbackEntry[]
): string {
	return entries.map((entry) => entry.file?.path ?? "").join("\u0000");
}
