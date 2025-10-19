/**
 * Input validation helpers for service methods
 */

import { ValidationError } from "./errors";

/**
 * Validates that a string is not empty
 */
export function validateNotEmpty(value: string | undefined | null, fieldName: string): void {
	if (!value || value.trim() === "") {
		throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
	}
}

/**
 * Validates that a value is defined and not null
 */
export function validateRequired<T>(value: T | undefined | null, fieldName: string): asserts value is T {
	if (value === undefined || value === null) {
		throw new ValidationError(`${fieldName} is required`, fieldName);
	}
}

/**
 * Validates calendar ID format (alphanumeric with some special chars)
 */
export function validateCalendarId(calendarId: string): void {
	validateNotEmpty(calendarId, "Calendar ID");

	// Google Calendar IDs should match email format or specific patterns
	const validPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-zA-Z0-9_-]+$/;
	if (!validPattern.test(calendarId)) {
		throw new ValidationError(
			"Invalid calendar ID format. Expected email-like format or alphanumeric ID.",
			"calendarId"
		);
	}
}

/**
 * Validates event ID format
 */
export function validateEventId(eventId: string): void {
	validateNotEmpty(eventId, "Event ID");

	// Event IDs should be alphanumeric with underscores
	if (!/^[a-zA-Z0-9_-]+$/.test(eventId)) {
		throw new ValidationError(
			"Invalid event ID format. Expected alphanumeric characters with hyphens or underscores.",
			"eventId"
		);
	}
}

/**
 * Validates date is not in the past (for creating future events)
 */
export function validateFutureDate(date: Date, fieldName: string): void {
	validateRequired(date, fieldName);

	const now = new Date();
	if (date < now) {
		throw new ValidationError(
			`${fieldName} cannot be in the past`,
			fieldName
		);
	}
}

/**
 * Validates date range (end must be after start)
 */
export function validateDateRange(start: Date, end: Date): void {
	validateRequired(start, "Start date");
	validateRequired(end, "End date");

	if (end <= start) {
		throw new ValidationError(
			"End date must be after start date",
			"endDate"
		);
	}
}

/**
 * Validates OAuth provider is supported
 */
export function validateOAuthProvider(provider: string): void {
	const supportedProviders = ["google", "microsoft"];
	if (!supportedProviders.includes(provider)) {
		throw new ValidationError(
			`Unsupported OAuth provider: ${provider}. Supported: ${supportedProviders.join(", ")}`,
			"provider"
		);
	}
}

/**
 * Validates URL format
 */
export function validateUrl(url: string, fieldName: string): void {
	validateNotEmpty(url, fieldName);

	try {
		new URL(url);
	} catch {
		throw new ValidationError(
			`Invalid URL format for ${fieldName}`,
			fieldName
		);
	}
}
